import type { DecodedIdToken } from "firebase-admin/auth";
import complianceConfig from "../../../config/compliance.json";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { recordAudit, writeAudit } from "@/server/audit/log";
import { assertRoleChange, sanitizeRoles } from "@/server/authorization/roles";
import { adminDb } from "@/server/db/admin";
import { loadMemberCopy } from "@/server/content/member-config";
import { listContent } from "@/server/content/store";
import { referralCodeFor } from "@/server/referrals/logic";
import type { Role, UserProfile, UserStatus } from "@/types/domain";

const CONSENT_VERSION = complianceConfig.consentVersion;

function nowIso(): string {
  return new Date().toISOString();
}

export async function bootstrapUser(token: DecodedIdToken): Promise<{ emailConflict: boolean }> {
  const db = adminDb();
  const now = nowIso();
  const email = token.email ?? null;
  const phoneNumber = token.phone_number ?? null;
  const provider = token.firebase?.sign_in_provider ?? "unknown";
  let emailConflict = false;

  if (email) {
    const existing = await db.collection("users").where("email", "==", email).limit(5).get();
    emailConflict = existing.docs.some((doc) => doc.id !== token.uid);
  }

  const code = referralCodeFor(token.uid);
  const copy = await loadMemberCopy().catch(() => null);
  const defaults = await listContent("watchlistDefaults", "admin").catch(() => []);
  const symbols = defaults.filter((row) => row.status === "published").map((row) => row.symbol);
  await db.runTransaction(async (tx) => {
    const userRef = db.collection("users").doc(token.uid);
    const roleRef = db.collection("userRoles").doc(token.uid);
    const codeRef = db.collection("referralCodes").doc(code);
    const accountRef = db.collection("referralAccounts").doc(token.uid);
    const userSnap = await tx.get(userRef);
    const roleSnap = await tx.get(roleRef);
    const codeSnap = await tx.get(codeRef);
    const accountSnap = await tx.get(accountRef);

    if (!userSnap.exists) {
      tx.set(userRef, {
        uid: token.uid,
        displayName: token.name ?? "",
        email,
        phoneNumber,
        photoURL: token.picture ?? null,
        status: "active",
        locale: "en-IN",
        timezone: "Asia/Kolkata",
        createdAt: now,
        updatedAt: now,
        consentVersion: null,
        consentAt: null,
        providers: [provider],
        tipPush: copy?.tipPushDefault === true,
        marketingPush: copy?.marketingPushDefault === true,
      });
      for (const symbol of symbols) {
        const itemId = `${token.uid}_${symbol}`;
        tx.set(db.collection("watchlistItems").doc(itemId), {
          id: itemId,
          uid: token.uid,
          symbol,
          createdAt: now,
        });
      }
    } else {
      const current = userSnap.data() ?? {};
      const providers = new Set<string>(Array.isArray(current.providers) ? current.providers.map(String) : []);
      providers.add(provider);
      tx.update(userRef, {
        email: email ?? current.email ?? null,
        phoneNumber: phoneNumber ?? current.phoneNumber ?? null,
        photoURL: current.photoURL || token.picture || null,
        displayName: current.displayName || token.name || "",
        providers: [...providers],
        updatedAt: now,
      });
    }

    if (!roleSnap.exists) {
      tx.set(roleRef, {
        uid: token.uid,
        roles: ["member"],
        grantedBy: "system",
        grantedAt: now,
        updatedAt: now,
      });
    }

    if (!codeSnap.exists) {
      tx.set(codeRef, { uid: token.uid, code, createdAt: now });
    }
    if (!accountSnap.exists) {
      tx.set(accountRef, { uid: token.uid, code, conversions: 0, createdAt: now, updatedAt: now });
    }
  });

  return { emailConflict };
}

export async function updateOwnProfile(
  uid: string,
  patch: { displayName?: string; locale?: string; timezone?: string; consentAccepted?: boolean },
): Promise<UserProfile> {
  const db = adminDb();
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError(404, "NOT_FOUND", "Profile not found.");
  const current = snap.data() ?? {};
  const next: Record<string, unknown> = { updatedAt: nowIso() };

  if (patch.displayName !== undefined) {
    const name = patch.displayName.trim();
    if (name.length < 2 || name.length > 80) {
      throw new AppError(400, "VALIDATION_ERROR", "Review the highlighted fields.", {
        displayName: "Use 2 to 80 characters.",
      });
    }
    next.displayName = name;
  }
  if (patch.locale !== undefined) {
    if (!/^[a-z]{2}-[A-Z]{2}$/.test(patch.locale)) {
      throw new AppError(400, "VALIDATION_ERROR", "Review the highlighted fields.", {
        locale: "Use a locale like en-IN.",
      });
    }
    next.locale = patch.locale;
  }
  if (patch.timezone !== undefined) {
    if (patch.timezone.length < 3 || patch.timezone.length > 64) {
      throw new AppError(400, "VALIDATION_ERROR", "Review the highlighted fields.", {
        timezone: "Choose a timezone.",
      });
    }
    next.timezone = patch.timezone;
  }
  if (patch.consentAccepted === true && !current.consentAt) {
    next.consentVersion = CONSENT_VERSION;
    next.consentAt = nowIso();
  }

  const displayName = String(next.displayName ?? current.displayName ?? "");
  const consentAt = String(next.consentAt ?? current.consentAt ?? "");
  const fields: Record<string, string> = {};
  if (!displayName) fields.displayName = "Name is required.";
  if (!consentAt) fields.consentAccepted = "Acknowledge the risk disclosure to continue.";
  if (Object.keys(fields).length > 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Name and the risk acknowledgement are required.", fields);
  }

  await ref.update(next);
  const updated = await ref.get();
  return {
    uid,
    displayName: String(updated.data()?.displayName ?? ""),
    email: updated.data()?.email ? String(updated.data()?.email) : null,
    phoneNumber: updated.data()?.phoneNumber ? String(updated.data()?.phoneNumber) : null,
    photoURL: updated.data()?.photoURL ? String(updated.data()?.photoURL) : null,
    status: (updated.data()?.status as UserStatus) ?? "active",
    locale: String(updated.data()?.locale ?? "en-IN"),
    timezone: String(updated.data()?.timezone ?? "Asia/Kolkata"),
    createdAt: String(updated.data()?.createdAt ?? ""),
    updatedAt: String(updated.data()?.updatedAt ?? ""),
    consentVersion: updated.data()?.consentVersion ? String(updated.data()?.consentVersion) : null,
    consentAt: updated.data()?.consentAt ? String(updated.data()?.consentAt) : null,
    providers: Array.isArray(updated.data()?.providers) ? updated.data()?.providers.map(String) : [],
  };
}

export async function requestDeletion(input: {
  uid: string;
  reason: string;
  requestId: string;
}): Promise<{ status: "pending"; requestId: string }> {
  const db = adminDb();
  const userRef = db.collection("users").doc(input.uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new AppError(404, "NOT_FOUND", "Profile not found.");
  if (snap.data()?.status === "deletion_pending") {
    return { status: "pending", requestId: input.requestId };
  }
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new AppError(400, "VALIDATION_ERROR", "Tell us briefly why you want the account removed.", {
      reason: "Enter at least 3 characters.",
    });
  }
  const now = nowIso();
  const deletionId = createId("del");
  await db.runTransaction(async (tx) => {
    tx.update(userRef, { status: "deletion_pending", updatedAt: now });
    tx.set(db.collection("deletionRequests").doc(deletionId), {
      id: deletionId,
      uid: input.uid,
      status: "pending",
      reason,
      requestedAt: now,
      requestId: input.requestId,
      note: "Personal data is retained until a reviewed deletion workflow runs. Retention rules are not approved yet.",
    });
    writeAudit(tx, db, {
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
  const db = adminDb();
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError(404, "NOT_FOUND", "Profile not found.");
  if (snap.data()?.status === "disabled") return;
  const now = nowIso();
  await ref.update({ status: "disabled", updatedAt: now });
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
  const db = adminDb();
  const snap = await db.collection("users").orderBy("createdAt", "desc").limit(limit).get();
  const users = await Promise.all(
    snap.docs.map(async (doc) => {
      const roleSnap = await db.collection("userRoles").doc(doc.id).get();
      const data = doc.data();
      return {
        uid: doc.id,
        displayName: String(data.displayName ?? ""),
        email: data.email ? String(data.email) : null,
        phoneNumber: data.phoneNumber ? String(data.phoneNumber) : null,
        photoURL: data.photoURL ? String(data.photoURL) : null,
        status: (data.status as UserStatus) ?? "active",
        locale: String(data.locale ?? "en-IN"),
        timezone: String(data.timezone ?? "Asia/Kolkata"),
        createdAt: String(data.createdAt ?? ""),
        updatedAt: String(data.updatedAt ?? ""),
        consentVersion: data.consentVersion ? String(data.consentVersion) : null,
        consentAt: data.consentAt ? String(data.consentAt) : null,
        providers: Array.isArray(data.providers) ? data.providers.map(String) : [],
        roles: sanitizeRoles(roleSnap.data()?.roles),
      };
    }),
  );
  return users;
}

export async function updateUserRoles(input: {
  actorUid: string;
  actorRoles: Role[];
  targetUid: string;
  roles: Role[];
  reason: string;
  requestId: string;
}): Promise<Role[]> {
  if (input.actorUid === input.targetUid) {
    throw new AppError(403, "FORBIDDEN", "You cannot change your own roles.");
  }
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new AppError(400, "VALIDATION_ERROR", "A reason is required.", { reason: "Enter at least 3 characters." });
  }
  const nextRoles = sanitizeRoles(input.roles);

  const db = adminDb();
  const target = await db.collection("users").doc(input.targetUid).get();
  if (!target.exists) throw new AppError(404, "NOT_FOUND", "That user does not exist.");

  const currentSnap = await db.collection("userRoles").doc(input.targetUid).get();
  const currentRoles = sanitizeRoles(currentSnap.data()?.roles);
  assertRoleChange(input.actorRoles, currentRoles, nextRoles);
  if (currentRoles.includes("super_admin") && !nextRoles.includes("super_admin")) {
    const supers = await db.collection("userRoles").where("roles", "array-contains", "super_admin").get();
    const others = supers.docs.filter((doc) => doc.id !== input.targetUid);
    if (others.length === 0) {
      throw new AppError(422, "BUSINESS_RULE_FAILED", "Keep at least one super admin.");
    }
  }

  const now = nowIso();
  await db.collection("userRoles").doc(input.targetUid).set({
    uid: input.targetUid,
    roles: nextRoles,
    grantedBy: input.actorUid,
    grantedAt: currentSnap.data()?.grantedAt ?? now,
    updatedAt: now,
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
  const db = adminDb();
  const ref = db.collection("users").doc(input.targetUid);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError(404, "NOT_FOUND", "That user does not exist.");
  const now = nowIso();
  await ref.update({ status: input.status, updatedAt: now });
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
