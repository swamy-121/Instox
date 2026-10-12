import complianceConfig from "../../../config/compliance.json";
import { arrayContains, desc, eq } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { insertAudit, recordAudit } from "@/server/audit/log";
import { assertRoleChange, sanitizeRoles } from "@/server/authorization/roles";
import { loadMemberCopy } from "@/server/content/member-config";
import { listContent } from "@/server/content/store";
import { getDb } from "@/server/db/client";
import { deletionRequests, referralAccounts, referralCodes, userRoles, users, watchlistItems } from "@/server/db/schema";
import { referralCodeFor } from "@/server/referrals/logic";
import type { Role, UserProfile, UserStatus } from "@/types/domain";

const CONSENT_VERSION = complianceConfig.consentVersion;

function nowIso(): string {
  return new Date().toISOString();
}

function asStatus(value: string | null | undefined): UserStatus {
  if (value === "disabled" || value === "deletion_pending") return value;
  return "active";
}

function toProfile(row: typeof users.$inferSelect): UserProfile {
  return {
    uid: row.id,
    displayName: row.displayName,
    email: row.email,
    phoneNumber: row.phoneNumber,
    photoURL: row.photoUrl,
    status: asStatus(row.status),
    locale: row.locale,
    timezone: row.timezone,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    consentVersion: row.consentVersion,
    consentAt: row.consentAt,
    providers: row.providers ?? [],
  };
}

export async function findUserById(uid: string): Promise<(typeof users.$inferSelect) | null> {
  const rows = await getDb().select().from(users).where(eq(users.id, uid)).limit(1);
  return rows[0] ?? null;
}

export async function findUserByPhone(phoneNumber: string): Promise<(typeof users.$inferSelect) | null> {
  const rows = await getDb().select().from(users).where(eq(users.phoneNumber, phoneNumber)).limit(1);
  return rows[0] ?? null;
}

export async function findUserByEmail(email: string): Promise<(typeof users.$inferSelect) | null> {
  const rows = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function bootstrapUser(input: {
  uid: string;
  email?: string | null;
  phoneNumber?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  provider: string;
}): Promise<{ emailConflict: boolean }> {
  const db = getDb();
  const now = nowIso();
  const email = input.email ?? null;
  const phoneNumber = input.phoneNumber ?? null;
  let emailConflict = false;
  if (email) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(5);
    emailConflict = existing.some((row) => row.id !== input.uid);
  }
  const code = referralCodeFor(input.uid);
  const copy = await loadMemberCopy().catch(() => null);
  const defaults = await listContent("watchlistDefaults", "admin").catch(() => []);
  const symbols = defaults.filter((row) => row.status === "published").map((row) => row.symbol);

  await db.transaction(async (tx) => {
    const current = await tx.select().from(users).where(eq(users.id, input.uid)).limit(1);
    if (!current[0]) {
      await tx.insert(users).values({
        id: input.uid,
        displayName: input.displayName ?? "",
        email,
        phoneNumber,
        photoUrl: input.photoURL ?? null,
        status: "active",
        locale: "en-IN",
        timezone: "Asia/Kolkata",
        createdAt: now,
        updatedAt: now,
        consentVersion: null,
        consentAt: null,
        providers: [input.provider],
        tipPush: copy?.tipPushDefault === true,
        marketingPush: copy?.marketingPushDefault === true,
      });
      for (const symbol of symbols) {
        await tx.insert(watchlistItems).values({
          id: `${input.uid}_${symbol}`,
          userId: input.uid,
          symbol,
          createdAt: now,
        }).onConflictDoNothing();
      }
    } else {
      const providers = new Set(current[0].providers ?? []);
      providers.add(input.provider);
      await tx.update(users).set({
        email: email ?? current[0].email,
        phoneNumber: phoneNumber ?? current[0].phoneNumber,
        photoUrl: current[0].photoUrl || input.photoURL || null,
        displayName: current[0].displayName || input.displayName || "",
        providers: [...providers],
        updatedAt: now,
      }).where(eq(users.id, input.uid));
    }
    const role = await tx.select().from(userRoles).where(eq(userRoles.userId, input.uid)).limit(1);
    if (!role[0]) {
      await tx.insert(userRoles).values({
        userId: input.uid,
        roles: ["member"],
        grantedBy: "system",
        grantedAt: now,
        updatedAt: now,
      });
    }
    const codeRow = await tx.select().from(referralCodes).where(eq(referralCodes.code, code)).limit(1);
    if (!codeRow[0]) {
      await tx.insert(referralCodes).values({ userId: input.uid, code, createdAt: now });
    }
    const account = await tx.select().from(referralAccounts).where(eq(referralAccounts.userId, input.uid)).limit(1);
    if (!account[0]) {
      await tx.insert(referralAccounts).values({ userId: input.uid, code, conversions: 0, createdAt: now, updatedAt: now });
    }
  });
  return { emailConflict };
}

export async function updateOwnProfile(
  uid: string,
  patch: { displayName?: string; locale?: string; timezone?: string; consentAccepted?: boolean },
): Promise<UserProfile> {
  const db = getDb();
  const current = await findUserById(uid);
  if (!current) throw new AppError(404, "NOT_FOUND", "Profile not found.");
  const next: Partial<typeof users.$inferInsert> = { updatedAt: nowIso() };

  if (patch.displayName !== undefined) {
    const name = patch.displayName.trim();
    if (name.length < 2 || name.length > 80) {
      throw new AppError(400, "VALIDATION_ERROR", "Review the highlighted fields.", { displayName: "Use 2 to 80 characters." });
    }
    next.displayName = name;
  }
  if (patch.locale !== undefined) {
    if (!/^[a-z]{2}-[A-Z]{2}$/.test(patch.locale)) {
      throw new AppError(400, "VALIDATION_ERROR", "Review the highlighted fields.", { locale: "Use a locale like en-IN." });
    }
    next.locale = patch.locale;
  }
  if (patch.timezone !== undefined) {
    if (patch.timezone.length < 3 || patch.timezone.length > 64) {
      throw new AppError(400, "VALIDATION_ERROR", "Review the highlighted fields.", { timezone: "Choose a timezone." });
    }
    next.timezone = patch.timezone;
  }
  if (patch.consentAccepted === true && !current.consentAt) {
    next.consentVersion = CONSENT_VERSION;
    next.consentAt = nowIso();
  }

  const displayName = next.displayName ?? current.displayName;
  const consentAt = next.consentAt ?? current.consentAt ?? "";
  const fields: Record<string, string> = {};
  if (!displayName) fields.displayName = "Name is required.";
  if (!consentAt) fields.consentAccepted = "Acknowledge the risk disclosure to continue.";
  if (Object.keys(fields).length > 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Name and the risk acknowledgement are required.", fields);
  }

  await db.update(users).set(next).where(eq(users.id, uid));
  const updated = await findUserById(uid);
  if (!updated) throw new AppError(404, "NOT_FOUND", "Profile not found.");
  return toProfile(updated);
}

export async function requestDeletion(input: {
  uid: string;
  reason: string;
  requestId: string;
}): Promise<{ status: "pending"; requestId: string }> {
  const db = getDb();
  const current = await findUserById(input.uid);
  if (!current) throw new AppError(404, "NOT_FOUND", "Profile not found.");
  if (current.status === "deletion_pending") return { status: "pending", requestId: input.requestId };
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new AppError(400, "VALIDATION_ERROR", "Tell us briefly why you want the account removed.", { reason: "Enter at least 3 characters." });
  }
  const now = nowIso();
  const deletionId = createId("del");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ status: "deletion_pending", updatedAt: now }).where(eq(users.id, input.uid));
    await tx.insert(deletionRequests).values({
      id: deletionId,
      userId: input.uid,
      status: "pending",
      reason,
      requestedAt: now,
      requestId: input.requestId,
      note: "Personal data is retained until a reviewed deletion workflow runs. Retention rules are not approved yet.",
    });
    await insertAudit(tx, {
      actorUid: input.uid,
      action: "account.deletion_requested",
      targetType: "user",
      targetId: input.uid,
      reason,
      requestId: input.requestId,
      occurredAt: now,
    });
  });
  return { status: "pending", requestId: deletionId };
}

export async function setOwnDisabled(uid: string, reason: string, requestId: string): Promise<void> {
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    throw new AppError(400, "VALIDATION_ERROR", "A reason is required.", { reason: "Enter at least 3 characters." });
  }
  const current = await findUserById(uid);
  if (!current) throw new AppError(404, "NOT_FOUND", "Profile not found.");
  if (current.status === "disabled") return;
  const now = nowIso();
  await getDb().update(users).set({ status: "disabled", updatedAt: now }).where(eq(users.id, uid));
  await recordAudit({
    actorUid: uid,
    action: "account.disabled_self",
    targetType: "user",
    targetId: uid,
    reason: trimmed,
    requestId,
    occurredAt: now,
  });
}

export async function listUsers(limit: number): Promise<Array<UserProfile & { roles: Role[] }>> {
  const db = getDb();
  const rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit);
  const roles = await db.select().from(userRoles);
  const byUser = new Map(roles.map((row) => [row.userId, row.roles]));
  return rows.map((row) => ({ ...toProfile(row), roles: sanitizeRoles(byUser.get(row.id)) }));
}

export async function updateUserRoles(input: {
  actorUid: string;
  actorRoles: Role[];
  targetUid: string;
  roles: Role[];
  reason: string;
  requestId: string;
}): Promise<Role[]> {
  if (input.actorUid === input.targetUid) throw new AppError(403, "FORBIDDEN", "You cannot change your own roles.");
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new AppError(400, "VALIDATION_ERROR", "A reason is required.", { reason: "Enter at least 3 characters." });
  }
  const nextRoles = sanitizeRoles(input.roles);
  const db = getDb();
  const target = await findUserById(input.targetUid);
  if (!target) throw new AppError(404, "NOT_FOUND", "That user does not exist.");
  const currentSnap = await db.select().from(userRoles).where(eq(userRoles.userId, input.targetUid)).limit(1);
  const currentRoles = sanitizeRoles(currentSnap[0]?.roles);
  assertRoleChange(input.actorRoles, currentRoles, nextRoles);
  if (currentRoles.includes("super_admin") && !nextRoles.includes("super_admin")) {
    const supers = await db.select().from(userRoles).where(arrayContains(userRoles.roles, ["super_admin"]));
    if (supers.filter((row) => row.userId !== input.targetUid).length === 0) {
      throw new AppError(422, "BUSINESS_RULE_FAILED", "Keep at least one super admin.");
    }
  }
  const now = nowIso();
  await db.insert(userRoles).values({
    userId: input.targetUid,
    roles: nextRoles,
    grantedBy: input.actorUid,
    grantedAt: currentSnap[0]?.grantedAt ?? now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: userRoles.userId,
    set: { roles: nextRoles, grantedBy: input.actorUid, updatedAt: now },
  });
  await recordAudit({
    actorUid: input.actorUid,
    action: "user.roles_updated",
    targetType: "user",
    targetId: input.targetUid,
    reason,
    requestId: input.requestId,
    occurredAt: now,
  });
  return nextRoles;
}

export async function updateUserStatus(input: {
  actorUid: string;
  targetUid: string;
  status: UserStatus;
  reason: string;
  requestId: string;
}): Promise<void> {
  if (input.actorUid === input.targetUid) {
    throw new AppError(403, "FORBIDDEN", "You cannot change your own account status here.");
  }
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new AppError(400, "VALIDATION_ERROR", "A reason is required.", { reason: "Enter at least 3 characters." });
  }
  if (!["active", "disabled", "deletion_pending"].includes(input.status)) {
    throw new AppError(400, "VALIDATION_ERROR", "Unknown account status.", { status: "Choose a valid status." });
  }
  const current = await findUserById(input.targetUid);
  if (!current) throw new AppError(404, "NOT_FOUND", "That user does not exist.");
  const now = nowIso();
  await getDb().update(users).set({ status: input.status, updatedAt: now }).where(eq(users.id, input.targetUid));
  await recordAudit({
    actorUid: input.actorUid,
    action: "user.status_updated",
    targetType: "user",
    targetId: input.targetUid,
    reason: `${input.status}: ${reason}`,
    requestId: input.requestId,
    occurredAt: now,
  });
}

export async function rolesFor(uid: string): Promise<Role[]> {
  const rows = await getDb().select().from(userRoles).where(eq(userRoles.userId, uid)).limit(1);
  return sanitizeRoles(rows[0]?.roles);
}
