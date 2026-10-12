import { AppError } from "@/lib/errors";
import { requireActor, type Actor } from "@/server/auth/actor";
import { canManageCrm, canManageIntegrations, canManageOperations } from "@/server/authorization/roles";
import { assertRecentAuth } from "@/server/authorization/session-policy";

export async function requireOperations(request: Request, options?: { recent?: boolean }): Promise<Actor> {
  const actor = await requireActor(request);
  if (!canManageOperations(actor.roles)) {
    throw new AppError(403, "FORBIDDEN", "You cannot change operations settings.");
  }
  if (options?.recent) assertRecentAuth(actor.authTime, Date.now());
  return actor;
}

export async function requireCrm(request: Request): Promise<Actor> {
  const actor = await requireActor(request);
  if (!canManageCrm(actor.roles)) {
    throw new AppError(403, "FORBIDDEN", "CRM is limited to support and administrators.");
  }
  return actor;
}

export async function requireSuperAdmin(request: Request, options?: { recent?: boolean }): Promise<Actor> {
  const actor = await requireActor(request);
  if (!canManageIntegrations(actor.roles)) {
    throw new AppError(403, "FORBIDDEN", "Only a super admin can manage integration keys.");
  }
  if (options?.recent) assertRecentAuth(actor.authTime, Date.now());
  return actor;
}
