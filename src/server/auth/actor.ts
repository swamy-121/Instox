import { eq } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { resolveEntitlement } from "@/server/authorization/entitlements";
import { resolveRoles } from "@/server/authorization/roles";
import { assertAccountActive } from "@/server/authorization/session-policy";
import { loadSession, readSessionToken } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { entitlements, users } from "@/server/db/schema";
import { rolesFor } from "@/server/users/repo";
import type { EntitlementRecord, ResolvedEntitlement, Role, UserProfile, UserStatus } from "@/types/domain";

export type Actor = {
  uid: string;
  authTime: number | undefined;
  user: UserProfile;
  roles: Role[];
  entitlement: ResolvedEntitlement;
};

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

export async function requireActor(request: Request, options?: { allowInactive?: boolean }): Promise<Actor> {
  const token = readSessionToken(request);
  if (!token) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const session = await loadSession(token);
  if (!session) throw new AppError(401, "UNAUTHENTICATED", "Your session is missing or has expired. Sign in again.");

  const rows = await getDb().select().from(users).where(eq(users.id, session.userId)).limit(1);
  const row = rows[0];
  if (!row) throw new AppError(401, "UNAUTHENTICATED", "Finish sign-in before continuing.");

  const user = toProfile(row);
  if (!options?.allowInactive) assertAccountActive(user.status);

  const [roles, entitlementRows] = await Promise.all([
    rolesFor(session.userId),
    getDb().select().from(entitlements).where(eq(entitlements.userId, session.userId)).limit(1),
  ]);
  const stored = entitlementRows[0];
  const record: EntitlementRecord | null = stored
    ? {
        uid: stored.userId,
        planId: stored.planId ?? "",
        status: stored.status === "active" || stored.status === "grace" || stored.status === "expired" || stored.status === "revoked" ? stored.status : "expired",
        startsAt: stored.startsAt ?? "",
        endsAt: stored.endsAt ?? "",
        sourceOrderId: stored.sourceOrderId,
        source: stored.source,
        updatedAt: stored.updatedAt,
        version: stored.version,
      }
    : null;

  return {
    uid: session.userId,
    authTime: session.authTime,
    user,
    roles: resolveRoles(roles),
    entitlement: resolveEntitlement(record, new Date()),
  };
}

export function profileComplete(user: UserProfile): boolean {
  return Boolean(user.displayName.trim() && user.consentAt && user.consentVersion);
}
