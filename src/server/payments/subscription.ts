export type SubscriptionStatus =
  | "created"
  | "checkout_pending"
  | "active"
  | "past_due"
  | "grace_period"
  | "expired"
  | "cancelled_at_period_end"
  | "cancelled"
  | "refunded"
  | "disputed";

export type SubscriptionAction =
  | "checkout_started"
  | "payment_captured"
  | "payment_failed"
  | "renewal_failed"
  | "enter_grace"
  | "expire"
  | "cancel_at_period_end"
  | "refunded"
  | "disputed";

const TRANSITIONS: Record<SubscriptionStatus, Partial<Record<SubscriptionAction, SubscriptionStatus>>> = {
  created: { checkout_started: "checkout_pending", payment_captured: "active", payment_failed: "cancelled" },
  checkout_pending: { payment_captured: "active", payment_failed: "cancelled" },
  active: {
    renewal_failed: "past_due",
    cancel_at_period_end: "cancelled_at_period_end",
    refunded: "refunded",
    disputed: "disputed",
    payment_captured: "active",
  },
  past_due: { payment_captured: "active", enter_grace: "grace_period", expire: "expired" },
  grace_period: { payment_captured: "active", expire: "expired" },
  cancelled_at_period_end: { expire: "expired", payment_captured: "active" },
  expired: { payment_captured: "active" },
  cancelled: {},
  refunded: {},
  disputed: {},
};

export function nextSubscriptionStatus(current: SubscriptionStatus, action: SubscriptionAction): SubscriptionStatus | null {
  return TRANSITIONS[current][action] ?? null;
}

export function subscriptionActionForPayment(
  eventType: "payment.captured" | "payment.failed" | "payment.refunded" | "payment.disputed",
): SubscriptionAction {
  if (eventType === "payment.captured") return "payment_captured";
  if (eventType === "payment.failed") return "payment_failed";
  if (eventType === "payment.refunded") return "refunded";
  return "disputed";
}

/** Cancelling keeps access until the current period end. It does not revoke immediately. */
export function cancellationKeepsAccessUntil(periodEnd: string, now: Date): boolean {
  return Date.parse(periodEnd) > now.getTime();
}
