import { z } from "zod";
import { createId } from "@/lib/ids";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, requireIdempotencyKey, withApi } from "@/server/http";
import { decideShopOrder } from "@/server/shop/catalog";

const bodySchema = z.object({ productId: z.string().min(1).max(64) }).strict();

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/shop/orders", async ({ requestId }) => {
    const actor = await requireActor(request);
    const snap = await adminDb().collection("shopOrders").where("uid", "==", actor.uid).limit(20).get();
    const orders = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        productId: String(data.productId ?? ""),
        amountMinor: Number(data.amountMinor ?? 0),
        currency: String(data.currency ?? ""),
        status: String(data.status ?? ""),
        fulfillment: "unconfigured",
        grantsEntitlement: false,
        createdAt: String(data.createdAt ?? ""),
      };
    });
    return apiOk({ orders }, requestId);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/shop/orders", async ({ requestId }) => {
    const actor = await requireActor(request);
    const idempotencyKey = requireIdempotencyKey(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Choose a product. Price is not accepted from the client.", {
        productId: "Choose a product.",
      });
    }
    const decision = decideShopOrder(parsed.data.productId);
    const db = adminDb();
    const existing = await db.collection("idempotencyKeys").doc(`shop_${idempotencyKey}`).get();
    if (existing.exists) {
      const orderId = String(existing.data()?.orderId ?? "");
      const order = await db.collection("shopOrders").doc(orderId).get();
      if (!order.exists || order.data()?.uid !== actor.uid) {
        throw new AppError(409, "STATE_CONFLICT", "That idempotency key was already used.");
      }
      return apiOk({ order: order.data(), message: decision.message }, requestId);
    }
    const orderId = createId("shop");
    const now = new Date().toISOString();
    const order = {
      id: orderId,
      uid: actor.uid,
      productId: decision.product.id,
      amountMinor: decision.amountMinor,
      currency: decision.currency,
      status: decision.status,
      fulfillment: decision.fulfillment,
      grantsEntitlement: false,
      idempotencyKey,
      createdAt: now,
    };
    await db.runTransaction(async (tx) => {
      tx.set(db.collection("shopOrders").doc(orderId), order);
      tx.set(db.collection("idempotencyKeys").doc(`shop_${idempotencyKey}`), {
        orderId,
        action: "shop.create",
        actorUid: actor.uid,
        createdAt: now,
      });
    });
    return apiOk({ order, message: decision.message }, requestId, null, 201);
  });
}
