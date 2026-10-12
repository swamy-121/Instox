import { eq } from "drizzle-orm";
import { z } from "zod";
import { createId } from "@/lib/ids";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { idempotencyKeys, paymentOrders, subscriptions } from "@/server/db/schema";
import { isUniqueViolation } from "@/server/db/sql-error";
import { apiOk, assertRateLimit, clientKey, readJson, requireIdempotencyKey, withApi } from "@/server/http";
import { getPaymentProvider } from "@/server/payments/adapter";
import { listContent } from "@/server/content/store";
import { priceOrder } from "@/server/payments/plans";
import type { PlanConfig } from "@/types/domain";

const bodySchema = z.object({ planId: z.string().min(1).max(64) }).strict();

function presentOrder(row: typeof paymentOrders.$inferSelect) {
  return {
    id: row.id,
    uid: row.userId,
    planId: row.planId,
    provider: row.provider,
    providerOrderId: row.providerOrderId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    verifiedAt: row.verifiedAt,
    failureCode: row.failureCode,
    placeholder: row.placeholder,
    entitlementGranted: row.entitlementGranted,
  };
}

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/payment-orders", async ({ requestId }) => {
    const actor = await requireActor(request);
    const orderId = new URL(request.url).searchParams.get("orderId") ?? "";
    if (!orderId) throw new AppError(400, "VALIDATION_ERROR", "Send an order id.", { orderId: "Missing order." });
    const rows = await getDb().select().from(paymentOrders).where(eq(paymentOrders.id, orderId)).limit(1);
    const row = rows[0];
    if (!row || row.userId !== actor.uid) throw new AppError(404, "NOT_FOUND", "That payment order was not found.");
    return apiOk({ orderId, planId: row.planId, amountMinor: row.amountMinor, currency: row.currency, status: row.status }, requestId);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/payment-orders", async ({ requestId }) => {
    assertRateLimit(clientKey(request, "payment"), 10, 60_000);
    const actor = await requireActor(request);
    const idempotencyKey = requireIdempotencyKey(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Send a plan id only. Amount and paid state are not accepted.", { planId: "Choose a plan." });
    }
    const storedPlans = await listContent("plans", "admin");
    const stored = storedPlans.find((plan) => plan.id === parsed.data.planId);
    const priced = stored ? priceOrder(parsed.data.planId, [stored as PlanConfig]) : priceOrder(parsed.data.planId);
    const db = getDb();
    const keyId = `pay_${idempotencyKey}`;
    const existingKey = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.id, keyId)).limit(1);
    if (existingKey[0]) {
      const orderRows = await db.select().from(paymentOrders).where(eq(paymentOrders.id, existingKey[0].orderId ?? "")).limit(1);
      const order = orderRows[0];
      if (!order || order.userId !== actor.uid) throw new AppError(409, "STATE_CONFLICT", "That idempotency key was already used.");
      return apiOk({ order: presentOrder(order), checkout: existingKey[0].checkout }, requestId);
    }

    const orderId = createId("ord");
    const provider = await getPaymentProvider();
    const checkout = await provider.createCheckoutSession({
      orderId,
      amountMinor: priced.amountMinor,
      currency: priced.currency,
      planId: priced.plan.id,
    });
    const now = new Date().toISOString();
    const status = checkout.session ? "checkout_pending" : "created";
    const order = {
      id: orderId,
      userId: actor.uid,
      planId: priced.plan.id,
      provider: provider.id,
      providerOrderId: null,
      amountMinor: priced.amountMinor,
      currency: priced.currency,
      status,
      idempotencyKey,
      createdAt: now,
      expiresAt: null,
      verifiedAt: null,
      failureCode: null,
      placeholder: checkout.remote === false,
      entitlementGranted: false,
    };
    try {
      await db.transaction(async (tx) => {
        await tx.insert(paymentOrders).values(order);
        await tx.insert(subscriptions).values({
          id: orderId,
          userId: actor.uid,
          planId: priced.plan.id,
          status,
          periodEnd: null,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(idempotencyKeys).values({
          id: keyId,
          orderId,
          action: "payment.create",
          actorUid: actor.uid,
          checkout,
          createdAt: now,
        });
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const again = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.id, keyId)).limit(1);
      const orderRows = await db.select().from(paymentOrders).where(eq(paymentOrders.id, again[0]?.orderId ?? "")).limit(1);
      if (!orderRows[0] || orderRows[0].userId !== actor.uid) throw new AppError(409, "STATE_CONFLICT", "That idempotency key was already used.");
      return apiOk({ order: presentOrder(orderRows[0]), checkout: again[0]?.checkout }, requestId);
    }
    return apiOk(
      {
        orderId,
        checkout,
        amountMinor: order.amountMinor,
        currency: order.currency,
        status: order.status,
        placeholder: order.placeholder,
        message: checkout.message,
      },
      requestId,
      null,
      201,
    );
  });
}
