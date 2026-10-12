import type { AccessTier, EntitlementRecord, ResolvedEntitlement } from "@/types/domain";

const PREMIUM_STATUSES = new Set(["active", "grace"]);

export function resolveEntitlement(
  record: EntitlementRecord | null,
  now: Date,
): ResolvedEntitlement {
  if (!record) {
    return { tier: "free", planId: null, status: "none", startsAt: null, endsAt: null };
  }

  const base = {
    planId: record.planId,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
  };

  if (!PREMIUM_STATUSES.has(record.status)) {
    return { ...base, tier: "free", status: record.status };
  }

  const start = Date.parse(record.startsAt);
  const end = Date.parse(record.endsAt);
  const time = now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || time < start || time > end) {
    return { ...base, tier: "free", status: "expired" };
  }

  return { ...base, tier: "premium", status: record.status };
}

export function viewerTier(entitlement: ResolvedEntitlement | null): AccessTier {
  return entitlement?.tier === "premium" ? "premium" : "free";
}

/**
 * Entitlement grants require a verified provider event and an approved plan.
 * The stub provider never sets providerVerified, and placeholder plans are not approved.
 */
export function canGrantEntitlement(input: {
  providerVerified: boolean;
  planApproved: boolean;
}): boolean {
  return input.providerVerified === true && input.planApproved === true;
}
