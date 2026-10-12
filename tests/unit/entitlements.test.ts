import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { canGrantEntitlement, resolveEntitlement } from "@/server/authorization/entitlements";
import { assertRoleChange, canAssignRole, resolveRoles } from "@/server/authorization/roles";
import { isRecentAuth } from "@/server/authorization/session-policy";
import type { EntitlementRecord } from "@/types/domain";

const now = new Date("2026-10-11T12:00:00.000Z");

function record(overrides: Partial<EntitlementRecord> = {}): EntitlementRecord {
  return {
    uid: "user_1",
    planId: "premium_monthly",
    status: "active",
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2026-11-01T00:00:00.000Z",
    sourceOrderId: "ord_1",
    source: "server",
    updatedAt: "2026-10-01T00:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

describe("entitlements", () => {
  it("treats an active or grace window as premium and everything else as free", () => {
    expect(resolveEntitlement(null, now).tier).toBe("free");
    expect(resolveEntitlement(record(), now).tier).toBe("premium");
    expect(resolveEntitlement(record({ status: "grace" }), now).tier).toBe("premium");
    expect(resolveEntitlement(record({ status: "revoked" }), now)).toMatchObject({ tier: "free", status: "revoked" });
    expect(resolveEntitlement(record({ status: "expired" }), now).tier).toBe("free");
    expect(resolveEntitlement(record({ startsAt: "2026-10-12T00:00:00.000Z" }), now)).toMatchObject({
      tier: "free",
      status: "expired",
    });
    expect(resolveEntitlement(record({ endsAt: "2026-10-11T11:00:00.000Z" }), now).tier).toBe("free");
  });

  it("does not grant premium from an unverified payment or an unapproved plan", () => {
    expect(canGrantEntitlement({ providerVerified: false, planApproved: false })).toBe(false);
    expect(canGrantEntitlement({ providerVerified: true, planApproved: false })).toBe(false);
    expect(canGrantEntitlement({ providerVerified: false, planApproved: true })).toBe(false);
    expect(canGrantEntitlement({ providerVerified: true, planApproved: true })).toBe(true);
  });

  it("ignores client role claims and limits who can change privileged roles", () => {
    expect(resolveRoles(["member"], { admin: true, role: "super_admin" })).toEqual(["member"]);
    expect(resolveRoles(["not_a_role", "editor", "editor"], {})).toEqual(["editor"]);
    expect(canAssignRole(["admin"], "publisher")).toBe(true);
    expect(canAssignRole(["admin"], "super_admin")).toBe(false);
    expect(canAssignRole(["super_admin"], "admin")).toBe(true);
    expect(() => assertRoleChange(["admin"], ["member"], ["admin"])).toThrow(AppError);
    expect(() => assertRoleChange(["admin"], ["admin", "member"], ["admin", "member"])).not.toThrow();
    expect(() => assertRoleChange(["super_admin"], ["member"], [])).toThrow(AppError);
  });

  it("requires a recent sign-in for sensitive actions", () => {
    const nowMs = Date.parse("2026-10-11T12:00:00.000Z");
    expect(isRecentAuth(nowMs / 1000 - 60, nowMs)).toBe(true);
    expect(isRecentAuth(nowMs / 1000 - 16 * 60, nowMs)).toBe(false);
    expect(isRecentAuth(nowMs / 1000 + 30, nowMs)).toBe(false);
  });
});
