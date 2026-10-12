import { createHash } from "node:crypto";
import { AppError } from "@/lib/errors";
import { adminDb } from "@/server/db/admin";
import { apiOk, withApi } from "@/server/http";
import { refreshIntegrations } from "@/server/integrations/store";
import { paymentProviderById } from "@/server/payments/adapter";
import { accessDaysForPlan } from "@/server/payments/access-window";
import { applyPaymentEvent, entitlementEffect } from "@/server/payments/apply-event";
import { loadPlans } from "@/server/payments/plans";
import { nextSubscriptionStatus, subscriptionActionForPayment, type SubscriptionStatus } from "@/server/payments/subscription";
import type { PaymentOrderStatus } from "@/types/domain";

function asOrderStatus(value: unknown): PaymentOrderStatus {
  if (
    value === "created" ||
    value === "checkout_pending" ||
    value === "paid_verified" ||
    value === "failed" ||
    value === "refunded" ||
    value === "disputed"
  ) {
    return value;
  }
  throw new AppError(409, "STATE_CONFLICT", "The stored order status is not recognized.");
}

function asSubscriptionStatus(value: unknown): SubscriptionStatus {
  if (
    value === "created" ||
    value === "checkout_pending" ||
    value === "active" ||
    value === "past_due" ||
    value === "grace_period" ||
    value === "expired" ||
    value === "cancelled_at_period_end" ||
    value === "cancelled" ||
    value === "refunded" ||
    value === "disputed"
  ) {
    return value;
  }
  return "created";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
): Promise<Response> {
  return withApi(request, "POST /api/v1/webhooks/:provider", async ({ requestId }) => {
    const { provider: providerParam } = await context.params;
    await refreshIntegrations();
    const provider = paymentProviderById(providerParam.toLowerCase());
    if (!provider || provider.id === "stub") {
      throw new AppError(404, "NOT_FOUND", "Unknown payment provider.");
    }
    const rawBody = await request.text();
    if (!provider.verifyWebhookSignature(rawBody, request.headers)) {
      throw new AppError(403, "FORBIDDEN", "The payment event signature could not be verified.");
    }
    const parsed = provider.parseWebhook(rawBody);
    if (!parsed?.orderId) {
      throw new AppError(422, "BUSINESS_RULE_FAILED", "The payment event could not be read.");
    }

    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const eventDocId = `${provider.id}_${parsed.providerEventId}`;
    const db = adminDb();
    const result = await db.runTransaction(async (tx) => {
      const eventRef = db.collection("paymentEvents").doc(eventDocId);
      const orderRef = db.collection("paymentOrders").doc(parsed.orderId as string);
      const eventSnap = await tx.get(eventRef);
      if (eventSnap.exists) {
        return { duplicate: true, granted: false, status: null as string | null };
      }
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) {
        throw new AppError(404, "NOT_FOUND", "No matching order.");
      }
      const data = orderSnap.data() ?? {};
      const uid = String(data.uid ?? "");
      const planId = String(data.planId ?? "");
      const filePlan = loadPlans().plans.find((item) => item.id === planId);
      const planSnap = planId ? await tx.get(db.collection("plans").doc(planId)) : null;
      const storedPlan = planSnap?.data();
      const plan = {
        accessDays: typeof storedPlan?.accessDays === "number" ? storedPlan.accessDays : filePlan?.accessDays,
      };
      const planApproved = planSnap?.exists ? storedPlan?.approved === true : filePlan?.approved === true;
      const entitlementRef = db.collection("userEntitlements").doc(uid);
      const subscriptionRef = db.collection("subscriptions").doc(parsed.orderId as string);
      const entitlementSnap = await tx.get(entitlementRef);
      const subscriptionSnap = await tx.get(subscriptionRef);
      const applied = applyPaymentEvent({
        order: {
          id: parsed.orderId as string,
          uid,
          planId: String(data.planId ?? ""),
          amountMinor: Number(data.amountMinor),
          currency: String(data.currency ?? ""),
          status: asOrderStatus(data.status),
          entitlementGranted: data.entitlementGranted === true,
        },
        event: {
          providerEventId: parsed.providerEventId,
          eventType: parsed.eventType,
          signatureVerified: true,
          amountMinor: parsed.amountMinor,
          currency: parsed.currency,
        },
        seenEventIds: new Set(),
        planApproved,
      });
      const effect = entitlementEffect(applied);
      const now = new Date().toISOString();
      const days = effect === "grant" ? accessDaysForPlan(plan) : 0;
      const endsAt = effect === "grant" ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;

      tx.set(eventRef, {
        id: eventDocId,
        provider: provider.id,
        providerEventId: parsed.providerEventId,
        orderId: parsed.orderId,
        eventType: parsed.eventType,
        amountMinor: parsed.amountMinor,
        currency: parsed.currency,
        signatureVerified: true,
        payloadHash,
        receivedAt: now,
      });
      tx.update(orderRef, {
        status: applied.order.status,
        entitlementGranted: applied.order.entitlementGranted,
        verifiedAt: applied.order.status === "paid_verified" ? now : data.verifiedAt ?? null,
        updatedAt: now,
      });

      const currentSubscription = asSubscriptionStatus(subscriptionSnap.data()?.status);
      const nextSubscription = nextSubscriptionStatus(currentSubscription, subscriptionActionForPayment(parsed.eventType));
      if (nextSubscription) {
        tx.set(
          subscriptionRef,
          {
            id: parsed.orderId,
            uid,
            planId: String(data.planId ?? ""),
            status: nextSubscription,
            periodEnd: endsAt ?? subscriptionSnap.data()?.periodEnd ?? null,
            updatedAt: now,
            createdAt: subscriptionSnap.data()?.createdAt ?? now,
          },
          { merge: true },
        );
      }

      const entitlement = entitlementSnap.data();
      if (effect === "grant") {
        tx.set(entitlementRef, {
          uid,
          planId: String(data.planId ?? ""),
          status: "active",
          startsAt: now,
          endsAt,
          sourceOrderId: parsed.orderId,
          source: "payment",
          updatedAt: now,
          version: Number(entitlement?.version ?? 0) + 1,
        });
      } else if (effect === "revoke" && entitlement?.source === "payment" && entitlement?.sourceOrderId === parsed.orderId) {
        tx.set(
          entitlementRef,
          {
            status: "revoked",
            updatedAt: now,
            version: Number(entitlement?.version ?? 0) + 1,
          },
          { merge: true },
        );
      }

      return { duplicate: false, granted: effect === "grant", status: applied.order.status };
    });

    return apiOk({ accepted: true, duplicate: result.duplicate, granted: result.granted, status: result.status }, requestId);
  }, { skipOriginCheck: true });
}
