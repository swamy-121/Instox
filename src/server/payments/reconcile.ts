export type ReconcileOrder = {
  id: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: string;
};

export type ReconcileEvent = {
  providerEventId: string;
  orderId: string | null;
  amountMinor: number | null;
  currency: string | null;
  signatureVerified: boolean;
  eventType: string;
};

export type ReconcileReport = {
  unmatchedOrders: string[];
  duplicateEvents: string[];
  amountMismatches: string[];
  unverifiedEvents: string[];
};

export function reconcilePayments(
  orders: ReconcileOrder[],
  events: ReconcileEvent[],
  now: Date,
  pendingOlderThanMs = 60 * 60 * 1000,
): ReconcileReport {
  const seen = new Set<string>();
  const duplicateEvents: string[] = [];
  const unverifiedEvents: string[] = [];
  const amountMismatches: string[] = [];
  const verifiedByOrder = new Map<string, ReconcileEvent[]>();

  for (const event of events) {
    if (seen.has(event.providerEventId)) duplicateEvents.push(event.providerEventId);
    seen.add(event.providerEventId);
    if (!event.signatureVerified) {
      unverifiedEvents.push(event.providerEventId);
      continue;
    }
    if (!event.orderId) continue;
    const list = verifiedByOrder.get(event.orderId) ?? [];
    list.push(event);
    verifiedByOrder.set(event.orderId, list);
  }

  const unmatchedOrders: string[] = [];
  for (const order of orders) {
    const related = verifiedByOrder.get(order.id) ?? [];
    const captured = related.some((event) => event.eventType === "payment.captured");
    const age = now.getTime() - Date.parse(order.createdAt);
    if ((order.status === "created" || order.status === "checkout_pending") && !captured && age > pendingOlderThanMs) {
      unmatchedOrders.push(order.id);
    }
    for (const event of related) {
      if (event.amountMinor !== order.amountMinor || event.currency !== order.currency) {
        amountMismatches.push(event.providerEventId);
      }
    }
  }

  return { unmatchedOrders, duplicateEvents, amountMismatches, unverifiedEvents };
}
