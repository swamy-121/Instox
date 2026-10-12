import { AppError } from "@/lib/errors";
import { ROLES, type Role } from "@/types/domain";

const ROLE_SET = new Set<string>(ROLES);

export function sanitizeRoles(input: unknown): Role[] {
  if (!Array.isArray(input)) return [];
  const roles: Role[] = [];
  for (const value of input) {
    if (typeof value === "string" && ROLE_SET.has(value) && !roles.includes(value as Role)) {
      roles.push(value as Role);
    }
  }
  return roles;
}

/**
 * Roles come from the server role document only.
 * Token claims, including any client-set custom claim, are ignored.
 */
export function resolveRoles(roleDocRoles: unknown, tokenClaims?: unknown): Role[] {
  void tokenClaims;
  return sanitizeRoles(roleDocRoles);
}

export function hasAnyRole(roles: readonly Role[], allowed: readonly Role[]): boolean {
  return allowed.some((role) => roles.includes(role));
}

export function canEditTips(roles: readonly Role[]): boolean {
  return hasAnyRole(roles, ["editor", "publisher", "admin", "super_admin"]);
}

export function canPublishTips(roles: readonly Role[]): boolean {
  return hasAnyRole(roles, ["publisher", "admin", "super_admin"]);
}

export function canViewUsers(roles: readonly Role[]): boolean {
  return hasAnyRole(roles, ["support", "admin", "super_admin"]);
}

export function canManageUsers(roles: readonly Role[]): boolean {
  return hasAnyRole(roles, ["admin", "super_admin"]);
}

export function canViewAudit(roles: readonly Role[]): boolean {
  return hasAnyRole(roles, ["admin", "super_admin"]);
}

export function canAccessAdmin(roles: readonly Role[]): boolean {
  return hasAnyRole(roles, ["editor", "publisher", "support", "admin", "super_admin"]);
}

export function canAssignRole(actorRoles: readonly Role[], targetRole: Role): boolean {
  if (actorRoles.includes("super_admin")) return true;
  if (!actorRoles.includes("admin")) return false;
  return targetRole === "member" || targetRole === "editor" || targetRole === "publisher" || targetRole === "support";
}

export function assertRoleChange(
  actorRoles: readonly Role[],
  currentRoles: readonly Role[],
  nextRoles: readonly Role[],
): void {
  if (nextRoles.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Choose at least one role.", {
      roles: "Choose at least one role.",
    });
  }
  const changed = [
    ...nextRoles.filter((role) => !currentRoles.includes(role)),
    ...currentRoles.filter((role) => !nextRoles.includes(role)),
  ];
  for (const role of changed) {
    if (!canAssignRole(actorRoles, role)) {
      throw new AppError(403, "FORBIDDEN", "You cannot assign that role.", {
        roles: `Not allowed to change ${role}.`,
      });
    }
  }
}
