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

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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

export const FCM_TOPICS = {
  transactional: "instox-tips",
  marketing: "instox-marketing",
} as const;

export type FcmJobStatus = "queued" | "skipped_unconfigured" | "skipped_no_consent" | "skipped_revoked";

export type FcmDevice = {
  tokenId: string;
  token: string;
  revoked: boolean;
  consent: PushConsent;
};

export type FcmOutbound = {
  token?: string;
  topic?: string;
  tokenId?: string;
  title: string;
  body: string;
  url: string;
};

type EnvLike = Record<string, string | undefined>;

/** Server send needs the public web certificate plus Admin credentials, and it stays off on the emulator. */
export function fcmConfigured(env: EnvLike = process.env): boolean {
  if (env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST) return false;
  return Boolean(env.NEXT_PUBLIC_FIREBASE_VAPID_KEY && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
}

/** The browser can request a token only when the web certificate and sender id are both set. */
export function clientMessagingConfigured(env: EnvLike = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_FIREBASE_VAPID_KEY && env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
}

export function fcmSendMode(env: EnvLike = process.env): "token" | "topic" {
  return env.FCM_SEND_MODE === "topic" ? "topic" : "token";
}

export function buildFcmDeliveries(input: {
  devices: FcmDevice[];
  kind: "transactional" | "marketing";
  payload: { title: string; body: string; url: string };
  configured: boolean;
  mode: "token" | "topic";
}): {
  messages: FcmOutbound[];
  jobs: Array<{ tokenId: string; status: FcmJobStatus }>;
  counts: Record<FcmJobStatus, number>;
} {
  const counts: Record<FcmJobStatus, number> = {
    queued: 0,
    skipped_unconfigured: 0,
    skipped_no_consent: 0,
    skipped_revoked: 0,
  };
  const jobs: Array<{ tokenId: string; status: FcmJobStatus }> = [];
  const eligible: FcmDevice[] = [];
  for (const device of input.devices) {
    const plan = pushDeliveryPlan({
      configured: input.configured,
      consent: device.consent,
      revoked: device.revoked,
      kind: input.kind,
    });
    counts[plan.status] += 1;
    jobs.push({ tokenId: device.tokenId, status: plan.status });
    if (plan.deliver) eligible.push(device);
  }
  const messages: FcmOutbound[] = [];
  if (eligible.length === 0) return { messages, jobs, counts };
  if (input.mode === "topic") {
    messages.push({
      topic: FCM_TOPICS[input.kind],
      title: input.payload.title,
      body: input.payload.body,
      url: input.payload.url,
    });
    return { messages, jobs, counts };
  }
  for (const device of eligible) {
    messages.push({
      token: device.token,
      tokenId: device.tokenId,
      title: input.payload.title,
      body: input.payload.body,
      url: input.payload.url,
    });
  }
  return { messages, jobs, counts };
}
