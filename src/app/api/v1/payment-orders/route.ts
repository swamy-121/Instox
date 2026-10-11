import { z } from "zod";
import { createId } from "@/lib/ids";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, assertRateLimit, clientKey, readJson, requireIdempotencyKey, withApi } from "@/server/http";
import { getPaymentProvider } from "@/server/payments/adapter";
import { priceOrder } from "@/server/payments/plans";

const bodySchema = z.object({ planId: z.string().min(1).max(64) }).strict();

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
    const priced = priceOrder(parsed.data.planId);
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
    const provider = getPaymentProvider();
    const checkout = await provider.createCheckoutSession({
      orderId,
      amountMinor: priced.amountMinor,
      currency: priced.currency,
      planId: priced.plan.id,
    });
    const now = new Date().toISOString();
    const order = {
      id: orderId,
      uid: actor.uid,
      planId: priced.plan.id,
      provider: provider.id,
      providerOrderId: null,
      amountMinor: priced.amountMinor,
      currency: priced.currency,
      status: "created",
      idempotencyKey,
      createdAt: now,
      expiresAt: null,
      verifiedAt: null,
      failureCode: null,
      placeholder: true,
      entitlementGranted: false,
    };
    await db.runTransaction(async (tx) => {
      tx.set(db.collection("paymentOrders").doc(orderId), order);
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
        placeholder: true,
        message: "Checkout is a stub. This does not activate premium.",
      },
      requestId,
      null,
      201,
    );
  });
}
