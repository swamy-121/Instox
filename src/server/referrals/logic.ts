import { createHash } from "node:crypto";
import features from "../../../config/features.json";
import { AppError } from "@/lib/errors";

export type ReferralDecision = {
  code: string;
  qualified: boolean;
  rewardEnabled: boolean;
  conversions: number;
  threshold: number;
  ledger: null | { status: "pending_approval" | "granted"; rewardDays: number; reason: string };
  message: string;
};

export function referralCodeFor(uid: string): string {
  const digest = createHash("sha256").update(`instox-referral:${uid}`).digest("hex").slice(0, 8).toUpperCase();
  return `INX${digest}`;
}

export function evaluateReferral(input: {
  code: string;
  referrerUid: string;
  referredUid: string;
  referrerStatus: "active" | "disabled" | "deletion_pending";
  existingReferralForReferred: boolean;
  conversions: number;
  rewardEnabled?: boolean;
  rewardGrantsEntitlement?: boolean;
  threshold?: number;
  rewardDays?: number;
}): ReferralDecision {
  const rewardEnabled = input.rewardEnabled ?? features.referrals.rewardEnabled;
  const grants = input.rewardGrantsEntitlement ?? features.referrals.rewardGrantsEntitlement;
  const threshold = input.threshold ?? features.referrals.qualifiedCount;
  const rewardDays = input.rewardDays ?? features.referrals.rewardDays;
  const code = input.code.trim().toUpperCase();

  if (input.referrerUid === input.referredUid) {
    throw new AppError(422, "BUSINESS_RULE_FAILED", "You cannot use your own referral code.");
  }
  if (input.referrerStatus !== "active") {
    throw new AppError(422, "BUSINESS_RULE_FAILED", "That referral code is not active.");
  }
  if (code !== referralCodeFor(input.referrerUid)) {
    throw new AppError(422, "BUSINESS_RULE_FAILED", "That referral code does not match.");
  }
  if (input.existingReferralForReferred) {
    throw new AppError(409, "STATE_CONFLICT", "This account already has a referral.");
  }

  const nextConversions = input.conversions + 1;
  const reached = nextConversions >= threshold;
  if (!rewardEnabled || !reached) {
    return {
      code,
      qualified: false,
      rewardEnabled,
      conversions: nextConversions,
      threshold,
      ledger: null,
      message: rewardEnabled
        ? "Code accepted. The reward threshold is not met, so nothing was granted."
        : "Code accepted. Referral rewards are turned off until the reward rule is approved, so nothing was granted.",
    };
  }

  return {
    code,
    qualified: true,
    rewardEnabled,
    conversions: nextConversions,
    threshold,
    ledger: grants
      ? { status: "granted", rewardDays, reason: "Configured reward grant." }
      : {
          status: "pending_approval",
          rewardDays,
          reason: "Threshold met, but entitlement grants from referrals are not approved.",
        },
    message: grants
      ? "Reward recorded."
      : "Threshold met. The reward stays pending because referral entitlements are not approved.",
  };
}
