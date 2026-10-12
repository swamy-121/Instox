import { z } from "zod";
import { createId } from "@/lib/ids";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, assertRateLimit, clientKey, readJson, requireIdempotencyKey, withApi } from "@/server/http";
import { getPaymentProvider } from "@/server/payments/adapter";
import { listContent } from "@/server/content/store";
import { priceOrder } from "@/server/payments/plans";
import type { PlanConfig } from "@/types/domain";

const bodySchema = z.object({ planId: z.string().min(1).max(64) }).strict();

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/payment-orders", async ({ requestId }) => {
    const actor = await requireActor(request);
    const orderId = new URL(request.url).searchParams.get("orderId") ?? "";
    if (!orderId) throw new AppError(400, "VALIDATION_ERROR", "Send an order id.", { orderId: "Missing order." });
    const snap = await adminDb().collection("paymentOrders").doc(orderId).get();
    if (!snap.exists || snap.data()?.uid !== actor.uid) {
      throw new AppError(404, "NOT_FOUND", "That payment order was not found.");
    }
    const data = snap.data() ?? {};
    return apiOk(
      {
        orderId,
        planId: String(data.planId ?? ""),
        amountMinor: Number(data.amountMinor ?? 0),
        currency: String(data.currency ?? ""),
        status: String(data.status ?? ""),
      },
      requestId,
    );
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/payment-orders", async ({ requestId }) => {
    assertRateLimit(clientKey(request, "payment"), 10, 60_000);
    const actor = await requireActor(request);
    const idempotencyKey = requireIdempotencyKey(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Send a plan id only. Amount and paid state are not accepted.", {
        planId: "Choose a plan.",
      });
    }
    const storedPlans = await listContent("plans", "admin");
    const stored = storedPlans.find((plan) => plan.id === parsed.data.planId);
    const priced = stored
      ? priceOrder(parsed.data.planId, [stored as PlanConfig])
      : priceOrder(parsed.data.planId);
    const db = adminDb();
    const existing = await db.collection("idempotencyKeys").doc(`pay_${idempotencyKey}`).get();
    if (existing.exists) {
      const orderId = String(existing.data()?.orderId ?? "");
      const order = await db.collection("paymentOrders").doc(orderId).get();
      if (!order.exists || order.data()?.uid !== actor.uid) {
        throw new AppError(409, "STATE_CONFLICT", "That idempotency key was already used.");
      }
      return apiOk({ order: order.data(), checkout: existing.data()?.checkout }, requestId);
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
      uid: actor.uid,
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
    await db.runTransaction(async (tx) => {
      tx.set(db.collection("paymentOrders").doc(orderId), order);
      tx.set(db.collection("subscriptions").doc(orderId), {
        id: orderId,
        uid: actor.uid,
        planId: priced.plan.id,
        status,
        periodEnd: null,
        createdAt: now,
        updatedAt: now,
      });
      tx.set(db.collection("idempotencyKeys").doc(`pay_${idempotencyKey}`), {
        orderId,
        action: "payment.create",
        actorUid: actor.uid,
        checkout,
        createdAt: now,
      });
    });
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
