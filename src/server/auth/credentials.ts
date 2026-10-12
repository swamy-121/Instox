import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, hashOtpCode, hashSessionToken, otpMatches, sessionCookie } from "@/server/auth/session";
import { resolveSmsProvider } from "@/server/auth/sms";
import { getDb } from "@/server/db/client";
import { otpChallenges, passwordResets, sessions, users } from "@/server/db/schema";
import { bootstrapUser, findUserByEmail, findUserByPhone } from "@/server/users/repo";

const OTP_TTL_MS = 5 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
export const REMEMBER_SECONDS = 5 * 24 * 60 * 60;
export const SHORT_SESSION_SECONDS = 12 * 60 * 60;

export function normalizePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed.startsWith("+")) return null;
  const digits = trimmed.slice(1).replace(/\D/g, "");
  if (digits.startsWith("91")) {
    return /^91[6-9]\d{9}$/.test(digits) ? `+${digits}` : null;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

export async function startPhoneOtp(phone: string): Promise<{ sent: true; delivery: "dev" | "apitxt" }> {
  const code = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
  const provider = await resolveSmsProvider();
  await provider.sendOtp({ to: phone, otp: code });
  const now = new Date();
  await getDb().insert(otpChallenges).values({
    id: createId("otp"),
    phoneNumber: phone,
    codeHash: hashOtpCode(phone, code),
    expiresAt: new Date(now.getTime() + OTP_TTL_MS).toISOString(),
    attempts: 0,
    consumedAt: null,
    createdAt: now.toISOString(),
  });
  return { sent: true, delivery: provider.id };
}

export async function verifyPhoneOtp(phone: string, code: string): Promise<{ uid: string; emailConflict: boolean; token: string }> {
  const db = getDb();
  const rows = await db
    .select()
    .from(otpChallenges)
    .where(and(eq(otpChallenges.phoneNumber, phone), isNull(otpChallenges.consumedAt)))
    .orderBy(desc(otpChallenges.createdAt))
    .limit(1);
  const challenge = rows[0];
  if (!challenge) throw new AppError(400, "VALIDATION_ERROR", "Request a code first.");
  if (Date.parse(challenge.expiresAt) <= Date.now()) {
    throw new AppError(400, "VALIDATION_ERROR", "That code has expired. Send a new one.");
  }
  if (challenge.attempts >= 5) {
    throw new AppError(429, "RATE_LIMITED", "Too many attempts. Wait and try again.");
  }
  if (!otpMatches(phone, code, challenge.codeHash)) {
    await db.update(otpChallenges).set({ attempts: challenge.attempts + 1 }).where(eq(otpChallenges.id, challenge.id));
    throw new AppError(400, "VALIDATION_ERROR", "That code is not valid.");
  }
  await db.update(otpChallenges).set({ consumedAt: new Date().toISOString() }).where(eq(otpChallenges.id, challenge.id));

  let user = await findUserByPhone(phone);
  let emailConflict = false;
  if (!user) {
    const uid = createId("usr");
    const created = await bootstrapUser({ uid, phoneNumber: phone, provider: "phone" });
    emailConflict = created.emailConflict;
    user = await findUserByPhone(phone);
  } else {
    const updated = await bootstrapUser({
      uid: user.id,
      email: user.email,
      phoneNumber: phone,
      displayName: user.displayName,
      photoURL: user.photoUrl,
      provider: "phone",
    });
    emailConflict = updated.emailConflict;
  }
  if (!user) throw new AppError(500, "INTERNAL_ERROR", "The account could not be opened.");
  const token = await createSession(user.id, REMEMBER_SECONDS);
  return { uid: user.id, emailConflict, token };
}

export function attachSession(response: Response, token: string, maxAge: number): Response {
  response.headers.append("set-cookie", sessionCookie(token, maxAge));
  return response;
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
  remember: boolean;
}): Promise<{ uid: string; token: string; maxAge: number }> {
  const email = input.email.trim().toLowerCase();
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new AppError(401, "UNAUTHENTICATED", "Email or password is incorrect.");
  }
  const maxAge = input.remember ? REMEMBER_SECONDS : SHORT_SESSION_SECONDS;
  const token = await createSession(user.id, maxAge);
  return { uid: user.id, token, maxAge };
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const message = "If that email is registered, a reset link is on its way.";
  const user = await findUserByEmail(email.trim().toLowerCase());
  if (!user?.passwordHash) return { message };
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await getDb().insert(passwordResets).values({
    id: createId("rst"),
    userId: user.id,
    tokenHash: hashSessionToken(`reset:${token}`),
    expiresAt: new Date(now.getTime() + RESET_TTL_MS).toISOString(),
    consumedAt: null,
    createdAt: now.toISOString(),
  });
  if (process.env.NODE_ENV !== "production") {
    console.info(`[auth] password reset for ${user.id}: /admin/login?reset=${token}`);
  }
  return { message };
}

export async function resetPassword(token: string, password: string): Promise<void> {
  if (password.length < 8 || password.length > 200) {
    throw new AppError(400, "VALIDATION_ERROR", "Use a password of 8 to 200 characters.", { password: "Use 8 to 200 characters." });
  }
  const db = getDb();
  const tokenHash = hashSessionToken(`reset:${token}`);
  const rows = await db.select().from(passwordResets).where(eq(passwordResets.tokenHash, tokenHash)).limit(1);
  const row = rows[0];
  if (!row || row.consumedAt || Date.parse(row.expiresAt) <= Date.now()) {
    throw new AppError(400, "VALIDATION_ERROR", "That reset link is no longer valid.");
  }
  await db.update(users).set({ passwordHash: hashPassword(password), updatedAt: new Date().toISOString() }).where(eq(users.id, row.userId));
  await db.update(passwordResets).set({ consumedAt: new Date().toISOString() }).where(eq(passwordResets.id, row.id));
  await db.delete(sessions).where(eq(sessions.userId, row.userId));
}
