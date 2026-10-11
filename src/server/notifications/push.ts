import { createHash } from "node:crypto";
import { AppError } from "@/lib/errors";

export type PushConsent = {
  tipPush: boolean;
  marketingPush: boolean;
};

export function pushIdempotencyKey(input: {
  tipId: string;
  version: number;
  audience: string;
  channel: string;
}): string {
  return ["push", input.tipId, String(input.version), input.audience, input.channel].join(":");
}

export function endpointHash(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

export function assertPushConsent(input: {
  kind: "transactional" | "marketing";
  consent: PushConsent;
  revoked: boolean;
}): void {
  if (input.revoked) {
    throw new AppError(422, "BUSINESS_RULE_FAILED", "This push subscription is revoked.");
  }
  if (input.kind === "marketing" && !input.consent.marketingPush) {
    throw new AppError(422, "BUSINESS_RULE_FAILED", "Marketing push was not accepted.");
  }
  if (input.kind === "transactional" && !input.consent.tipPush) {
    throw new AppError(422, "BUSINESS_RULE_FAILED", "Tip alerts were not accepted.");
  }
}

/** Notification text never includes entry, stop, targets, or rationale. */
export function safePushPayload(input: { symbol: string; accessTier: "free" | "premium"; tipId: string }): {
  title: string;
  body: string;
  url: string;
} {
  return {
    title: "Instox tip update",
    body:
      input.accessTier === "premium"
        ? `${input.symbol} has a premium tip. Open Instox to see whether your plan includes it.`
        : `${input.symbol} has a new free tip.`,
    url: `/tips/${input.tipId}`,
  };
}

export function pushDeliveryPlan(input: {
  configured: boolean;
  consent: PushConsent;
  revoked: boolean;
  kind: "transactional" | "marketing";
}): { deliver: boolean; status: "queued" | "skipped_unconfigured" | "skipped_no_consent" | "skipped_revoked" } {
  if (input.revoked) return { deliver: false, status: "skipped_revoked" };
  const allowed = input.kind === "marketing" ? input.consent.marketingPush : input.consent.tipPush;
  if (!allowed) return { deliver: false, status: "skipped_no_consent" };
  if (!input.configured) return { deliver: false, status: "skipped_unconfigured" };
  return { deliver: true, status: "queued" };
}

export function vapidConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}
