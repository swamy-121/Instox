import type { DecodedIdToken } from "firebase-admin/auth";
import { AppError } from "@/lib/errors";
import { resolveEntitlement } from "@/server/authorization/entitlements";
import { resolveRoles } from "@/server/authorization/roles";
import { assertAccountActive } from "@/server/authorization/session-policy";
import type { DocumentData } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/server/db/admin";
import type { EntitlementRecord, ResolvedEntitlement, Role, UserProfile } from "@/types/domain";

export type Actor = {
  uid: string;
  authTime: number | undefined;
  user: UserProfile;
  roles: Role[];
  entitlement: ResolvedEntitlement;
};

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

async function verifyToken(request: Request): Promise<DecodedIdToken> {
  const bearer = request.headers.get("authorization");
  try {
    if (bearer?.startsWith("Bearer ")) {
      return await adminAuth().verifyIdToken(bearer.slice("Bearer ".length).trim());
    }
    const session = readCookie(request, "instox_session");
    if (session) {
      return await adminAuth().verifySessionCookie(session);
    }
  } catch {
    throw new AppError(401, "UNAUTHENTICATED", "Your session is missing or has expired. Sign in again.");
  }
  throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
}

function asProfile(uid: string, data: DocumentData): UserProfile {
  return {
    uid,
    displayName: String(data.displayName ?? ""),
    email: data.email ? String(data.email) : null,
    phoneNumber: data.phoneNumber ? String(data.phoneNumber) : null,
    photoURL: data.photoURL ? String(data.photoURL) : null,
    status: data.status === "disabled" || data.status === "deletion_pending" ? data.status : "active",
    locale: String(data.locale ?? "en-IN"),
    timezone: String(data.timezone ?? "Asia/Kolkata"),
    createdAt: String(data.createdAt ?? ""),
    updatedAt: String(data.updatedAt ?? ""),
    consentVersion: data.consentVersion ? String(data.consentVersion) : null,
    consentAt: data.consentAt ? String(data.consentAt) : null,
    providers: Array.isArray(data.providers) ? data.providers.map(String) : [],
  };
}

export async function requireActor(request: Request, options?: { allowInactive?: boolean }): Promise<Actor> {
  const token = await verifyToken(request);
  const db = adminDb();
  const [userSnap, roleSnap, entitlementSnap] = await Promise.all([
    db.collection("users").doc(token.uid).get(),
    db.collection("userRoles").doc(token.uid).get(),
    db.collection("userEntitlements").doc(token.uid).get(),
  ]);

  if (!userSnap.exists) {
    throw new AppError(401, "UNAUTHENTICATED", "Finish sign-in before continuing.");
  }

  const user = asProfile(token.uid, userSnap.data() ?? {});
  if (!options?.allowInactive) {
    assertAccountActive(user.status);
  }

  const roles = resolveRoles(roleSnap.data()?.roles, token);
  const entitlement = entitlementSnap.exists
    ? resolveEntitlement(entitlementSnap.data() as EntitlementRecord, new Date())
    : resolveEntitlement(null, new Date());

  return {
    uid: token.uid,
    authTime: typeof token.auth_time === "number" ? token.auth_time : undefined,
    user,
    roles,
    entitlement,
  };
}

export function profileComplete(user: UserProfile): boolean {
  return Boolean(user.displayName.trim() && user.consentAt && user.consentVersion);
}
