import { AppError } from "@/lib/errors";
import type { PaymentOrderStatus } from "@/types/domain";

export type ProviderPaymentEvent = {
  providerEventId: string;
  eventType: "payment.captured" | "payment.failed" | "payment.refunded" | "payment.disputed";
  signatureVerified: boolean;
  amountMinor: number;
  currency: string;
};

const TRANSITIONS: Record<PaymentOrderStatus, Partial<Record<ProviderPaymentEvent["eventType"], PaymentOrderStatus>>> = {
  created: {
    "payment.captured": "paid_verified",
    "payment.failed": "failed",
  },
  checkout_pending: {
    "payment.captured": "paid_verified",
    "payment.failed": "failed",
  },
  paid_verified: {
    "payment.refunded": "refunded",
    "payment.disputed": "disputed",
  },
  failed: {},
  refunded: {},
  disputed: {},
};

export function nextPaymentStatus(
  current: PaymentOrderStatus,
  event: ProviderPaymentEvent,
  order: { amountMinor: number; currency: string },
  seenEventIds: ReadonlySet<string>,
): { status: PaymentOrderStatus; duplicate: boolean } {
  if (seenEventIds.has(event.providerEventId)) {
    return { status: current, duplicate: true };
  }
  if (!event.signatureVerified) {
    throw new AppError(403, "FORBIDDEN", "The payment event signature could not be verified.");
  }
  if (event.amountMinor !== order.amountMinor || event.currency !== order.currency) {
    throw new AppError(422, "BUSINESS_RULE_FAILED", "The payment amount does not match the order.");
  }
  const next = TRANSITIONS[current][event.eventType];
  if (!next) {
    throw new AppError(409, "STATE_CONFLICT", "That payment event does not apply to this order.");
  }
  return { status: next, duplicate: false };
}
