import { eq } from "drizzle-orm";
import { z } from "zod";
import { createId } from "@/lib/ids";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { idempotencyKeys, shopOrders } from "@/server/db/schema";
import { isUniqueViolation } from "@/server/db/sql-error";
import { apiOk, readJson, requireIdempotencyKey, withApi } from "@/server/http";
import { listContent } from "@/server/content/store";
import { decideShopOrder, type ShopProduct } from "@/server/shop/catalog";

const bodySchema = z.object({ productId: z.string().min(1).max(64) }).strict();

function present(row: typeof shopOrders.$inferSelect) {
  return {
    id: row.id,
    uid: row.userId,
    productId: row.productId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status,
    fulfillment: "unconfigured",
    grantsEntitlement: false,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt,
  };
}

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/shop/orders", async ({ requestId }) => {
    const actor = await requireActor(request);
    const rows = await getDb().select().from(shopOrders).where(eq(shopOrders.userId, actor.uid)).limit(20);
    return apiOk({ orders: rows.map(present) }, requestId);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/shop/orders", async ({ requestId }) => {
    const actor = await requireActor(request);
    const idempotencyKey = requireIdempotencyKey(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Choose a product. Price is not accepted from the client.", { productId: "Choose a product." });
    }
    const stored = await listContent("shopProducts", "admin");
    const products: ShopProduct[] = stored.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      priceMinor: product.priceMinor,
      currency: product.currency,
      active: product.active,
      approved: product.approved,
      fulfillment: "unconfigured",
    }));
    const decision = decideShopOrder(parsed.data.productId, products);
    const db = getDb();
    const keyId = `shop_${idempotencyKey}`;
    const existing = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.id, keyId)).limit(1);
    if (existing[0]) {
      const orderRows = await db.select().from(shopOrders).where(eq(shopOrders.id, existing[0].orderId ?? "")).limit(1);
      if (!orderRows[0] || orderRows[0].userId !== actor.uid) throw new AppError(409, "STATE_CONFLICT", "That idempotency key was already used.");
      return apiOk({ order: present(orderRows[0]), message: decision.message }, requestId);
    }
    const orderId = createId("shop");
    const now = new Date().toISOString();
    const order = {
      id: orderId,
      userId: actor.uid,
      productId: decision.product.id,
      amountMinor: decision.amountMinor,
      currency: decision.currency,
      status: decision.status,
      fulfillment: decision.fulfillment,
      grantsEntitlement: false,
      idempotencyKey,
      createdAt: now,
    };
    try {
      await db.transaction(async (tx) => {
        await tx.insert(shopOrders).values(order);
        await tx.insert(idempotencyKeys).values({ id: keyId, orderId, action: "shop.create", actorUid: actor.uid, createdAt: now });
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const again = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.id, keyId)).limit(1);
      const orderRows = await db.select().from(shopOrders).where(eq(shopOrders.id, again[0]?.orderId ?? "")).limit(1);
      if (!orderRows[0] || orderRows[0].userId !== actor.uid) throw new AppError(409, "STATE_CONFLICT", "That idempotency key was already used.");
      return apiOk({ order: present(orderRows[0]), message: decision.message }, requestId);
    }
    return apiOk({ order: { ...order, uid: actor.uid, fulfillment: "unconfigured", grantsEntitlement: false }, message: decision.message }, requestId, null, 201);
  });
}
