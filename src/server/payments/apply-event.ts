import { canGrantEntitlement } from "@/server/authorization/entitlements";
import { nextPaymentStatus, type ProviderPaymentEvent } from "@/server/payments/order-state";
import type { PaymentOrderStatus } from "@/types/domain";

export type StoredOrder = {
  id: string;
  uid: string;
  planId: string;
  amountMinor: number;
  currency: string;
  status: PaymentOrderStatus;
  entitlementGranted: boolean;
};

export type AppliedPayment = {
  order: StoredOrder;
  duplicate: boolean;
  grantEntitlement: boolean;
};

export function applyPaymentEvent(input: {
  order: StoredOrder;
  event: ProviderPaymentEvent;
  seenEventIds: ReadonlySet<string>;
  planApproved: boolean;
}): AppliedPayment {
  const next = nextPaymentStatus(input.order.status, input.event, input.order, input.seenEventIds);
  if (next.duplicate) {
    return { order: input.order, duplicate: true, grantEntitlement: false };
  }
  const grantEntitlement =
    next.status === "paid_verified" &&
    !input.order.entitlementGranted &&
    canGrantEntitlement({ providerVerified: true, planApproved: input.planApproved });
  return {
    order: {
      ...input.order,
      status: next.status,
      entitlementGranted: input.order.entitlementGranted || grantEntitlement,
    },
    duplicate: false,
    grantEntitlement,
  };
}

/** Refunds and disputes revoke a payment-sourced entitlement. Manual grants are left to the admin path. */
export function entitlementEffect(input: { grantEntitlement: boolean; order: { status: PaymentOrderStatus } }): "grant" | "revoke" | "none" {
  if (input.grantEntitlement) return "grant";
  if (input.order.status === "refunded" || input.order.status === "disputed") return "revoke";
  return "none";
}
