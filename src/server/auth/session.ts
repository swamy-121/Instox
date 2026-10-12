import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";

const COOKIE = "instox_session";

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.trim().length < 16) {
    throw new AppError(503, "PROVIDER_UNAVAILABLE", "Set SESSION_SECRET before signing anyone in.");
  }
  return secret;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(`${sessionSecret()}:${token}`).digest("hex");
}

export function hashOtpCode(phone: string, code: string): string {
  return createHash("sha256").update(`${sessionSecret()}:${phone}:${code}`).digest("hex");
}

export function otpMatches(phone: string, code: string, storedHash: string): boolean {
  const actual = Buffer.from(hashOtpCode(phone, code), "hex");
  const expected = Buffer.from(storedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function readSessionToken(request: Request): string | null {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    const token = bearer.slice("Bearer ".length).trim();
    if (token) return token;
  }
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookie(value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function createSession(userId: string, maxAgeSeconds: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await getDb().insert(sessions).values({
    tokenHash: hashSessionToken(token),
    userId,
    authTime: now.toISOString(),
    expiresAt: new Date(now.getTime() + maxAgeSeconds * 1000).toISOString(),
    createdAt: now.toISOString(),
  });
  return token;
}

export async function loadSession(token: string): Promise<{ userId: string; authTime: number } | null> {
  const row = await getDb().select().from(sessions).where(eq(sessions.tokenHash, hashSessionToken(token))).limit(1);
  const session = row[0];
  if (!session) return null;
  if (Date.parse(session.expiresAt) <= Date.now()) {
    await getDb().delete(sessions).where(eq(sessions.tokenHash, session.tokenHash));
    return null;
  }
  const authTime = Math.floor(Date.parse(session.authTime) / 1000);
  return { userId: session.userId, authTime: Number.isFinite(authTime) ? authTime : Math.floor(Date.now() / 1000) };
}

export async function revokeSession(token: string): Promise<void> {
  try {
    await getDb().delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
  } catch {
    // Signing out with a bad token still clears the cookie.
  }
}
