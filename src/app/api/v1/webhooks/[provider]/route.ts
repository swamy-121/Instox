import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { contentDocuments, entitlements, paymentEvents, paymentOrders, subscriptions } from "@/server/db/schema";
import { apiOk, withApi } from "@/server/http";
import { refreshIntegrations } from "@/server/integrations/store";
import { paymentProviderById } from "@/server/payments/adapter";
import { accessDaysForPlan } from "@/server/payments/access-window";
import { applyPaymentEvent, entitlementEffect } from "@/server/payments/apply-event";
import { loadPlans } from "@/server/payments/plans";
import { nextSubscriptionStatus, subscriptionActionForPayment, type SubscriptionStatus } from "@/server/payments/subscription";
import type { PaymentOrderStatus } from "@/types/domain";

function asOrderStatus(value: unknown): PaymentOrderStatus {
  if (value === "created" || value === "checkout_pending" || value === "paid_verified" || value === "failed" || value === "refunded" || value === "disputed") {
    return value;
  }
  throw new AppError(409, "STATE_CONFLICT", "The stored order status is not recognized.");
}

function asSubscriptionStatus(value: unknown): SubscriptionStatus {
  if (
    value === "created" || value === "checkout_pending" || value === "active" || value === "past_due" || value === "grace_period" ||
    value === "expired" || value === "cancelled_at_period_end" || value === "cancelled" || value === "refunded" || value === "disputed"
  ) {
    return value;
  }
  return "created";
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }): Promise<Response> {
  return withApi(request, "POST /api/v1/webhooks/:provider", async ({ requestId }) => {
    const { provider: providerParam } = await context.params;
    await refreshIntegrations();
    const provider = paymentProviderById(providerParam.toLowerCase());
    if (!provider || provider.id === "stub") throw new AppError(404, "NOT_FOUND", "Unknown payment provider.");
    const rawBody = await request.text();
    if (!provider.verifyWebhookSignature(rawBody, request.headers)) {
      throw new AppError(403, "FORBIDDEN", "The payment event signature could not be verified.");
    }
    const parsed = provider.parseWebhook(rawBody);
    if (!parsed?.orderId) throw new AppError(422, "BUSINESS_RULE_FAILED", "The payment event could not be read.");

    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const eventDocId = `${provider.id}_${parsed.providerEventId}`;
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const eventRows = await tx.select().from(paymentEvents).where(eq(paymentEvents.id, eventDocId)).limit(1);
      if (eventRows[0]) return { duplicate: true, granted: false, status: null as string | null };
      const orderRows = await tx.select().from(paymentOrders).where(eq(paymentOrders.id, parsed.orderId as string)).limit(1);
      const data = orderRows[0];
      if (!data) throw new AppError(404, "NOT_FOUND", "No matching order.");
      const uid = data.userId;
      const planId = data.planId;
      const filePlan = loadPlans().plans.find((item) => item.id === planId);
      const planRows = planId
        ? await tx.select().from(contentDocuments).where(and(eq(contentDocuments.collection, "plans"), eq(contentDocuments.id, planId))).limit(1)
        : [];
      const storedPlan = planRows[0]?.body;
      const plan = { accessDays: typeof storedPlan?.accessDays === "number" ? storedPlan.accessDays : filePlan?.accessDays };
      const planApproved = planRows[0] ? storedPlan?.approved === true : filePlan?.approved === true;
      const entitlementRows = await tx.select().from(entitlements).where(eq(entitlements.userId, uid)).limit(1);
      const subscriptionRows = await tx.select().from(subscriptions).where(eq(subscriptions.id, parsed.orderId as string)).limit(1);
      const applied = applyPaymentEvent({
        order: {
          id: parsed.orderId as string,
          uid,
          planId,
          amountMinor: data.amountMinor,
          currency: data.currency,
          status: asOrderStatus(data.status),
          entitlementGranted: data.entitlementGranted,
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
      await tx.insert(paymentEvents).values({
        id: eventDocId,
        provider: provider.id,
        providerEventId: parsed.providerEventId,
        orderId: parsed.orderId as string,
        eventType: parsed.eventType,
        amountMinor: parsed.amountMinor,
        currency: parsed.currency,
        signatureVerified: true,
        payloadHash,
        receivedAt: now,
      });
      await tx.update(paymentOrders).set({
        status: applied.order.status,
        entitlementGranted: applied.order.entitlementGranted,
        verifiedAt: applied.order.status === "paid_verified" ? now : data.verifiedAt,
        updatedAt: now,
      }).where(eq(paymentOrders.id, data.id));

      const currentSubscription = asSubscriptionStatus(subscriptionRows[0]?.status);
      const nextSubscription = nextSubscriptionStatus(currentSubscription, subscriptionActionForPayment(parsed.eventType));
      if (nextSubscription) {
        await tx.insert(subscriptions).values({
          id: parsed.orderId as string,
          userId: uid,
          planId,
          status: nextSubscription,
          periodEnd: endsAt ?? subscriptionRows[0]?.periodEnd ?? null,
          createdAt: subscriptionRows[0]?.createdAt ?? now,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: subscriptions.id,
          set: { status: nextSubscription, periodEnd: endsAt ?? subscriptionRows[0]?.periodEnd ?? null, updatedAt: now },
        });
      }

      const entitlement = entitlementRows[0];
      if (effect === "grant") {
        await tx.insert(entitlements).values({
          userId: uid,
          planId,
          status: "active",
          startsAt: now,
          endsAt,
          sourceOrderId: parsed.orderId as string,
          source: "payment",
          updatedAt: now,
          version: (entitlement?.version ?? 0) + 1,
        }).onConflictDoUpdate({
          target: entitlements.userId,
          set: {
            planId,
            status: "active",
            startsAt: now,
            endsAt,
            sourceOrderId: parsed.orderId as string,
            source: "payment",
            updatedAt: now,
            version: (entitlement?.version ?? 0) + 1,
          },
        });
      } else if (effect === "revoke" && entitlement?.source === "payment" && entitlement.sourceOrderId === parsed.orderId) {
        await tx.update(entitlements).set({ status: "revoked", updatedAt: now, version: entitlement.version + 1 }).where(eq(entitlements.userId, uid));
      }
      return { duplicate: false, granted: effect === "grant", status: applied.order.status };
    });

    return apiOk({ accepted: true, duplicate: result.duplicate, granted: result.granted, status: result.status }, requestId);
  }, { skipOriginCheck: true });
}
