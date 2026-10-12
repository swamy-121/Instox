import { eq } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { recordAudit } from "@/server/audit/log";
import { requireOperations } from "@/server/auth/operations";
import { getDb } from "@/server/db/client";
import { entitlements, paymentOrders, subscriptions } from "@/server/db/schema";
import { apiOk, readJson, withApi } from "@/server/http";
import { parseAdminOrderStatus } from "@/server/payments/order-admin";

const bodySchema = z.object({ status: z.string(), reason: z.string().trim().min(3).max(500) }).strict();

type Params = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, { params }: Params): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/orders/[orderId]", async ({ requestId }) => {
    const actor = await requireOperations(request, { recent: true });
    const { orderId } = await params;
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(orderId)) throw new AppError(404, "NOT_FOUND", "That order was not found.");
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "A status and a reason are required.", { reason: "Enter a reason." });
    const status = parseAdminOrderStatus(parsed.data.status);
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const orderRows = await tx.select().from(paymentOrders).where(eq(paymentOrders.id, orderId)).limit(1);
      const data = orderRows[0];
      if (!data) throw new AppError(404, "NOT_FOUND", "That order was not found.");
      const entitlementRows = await tx.select().from(entitlements).where(eq(entitlements.userId, data.userId)).limit(1);
      const subscriptionRows = await tx.select().from(subscriptions).where(eq(subscriptions.id, orderId)).limit(1);
      const now = new Date().toISOString();
      const entitlement = entitlementRows[0];
      const revoke = (status === "refunded" || status === "disputed") && entitlement?.source === "payment" && entitlement.sourceOrderId === orderId;
      const unchanged = data.status === status && !revoke;
      if (!unchanged) {
        await tx.update(paymentOrders).set({
          status,
          statusReason: parsed.data.reason,
          statusUpdatedBy: actor.uid,
          updatedAt: now,
        }).where(eq(paymentOrders.id, orderId));
        if (subscriptionRows[0]) {
          const subscriptionStatus = status === "failed" ? "cancelled" : status;
          await tx.update(subscriptions).set({ status: subscriptionStatus, updatedAt: now }).where(eq(subscriptions.id, orderId));
        }
        if (revoke && entitlement) {
          await tx.update(entitlements).set({ status: "revoked", updatedAt: now, version: entitlement.version + 1 }).where(eq(entitlements.userId, data.userId));
        }
      }
      return { unchanged, revoked: revoke, uid: data.userId };
    });
    if (!result.unchanged) {
      await recordAudit({
        actorUid: actor.uid,
        action: `payment.order_${status}`,
        targetType: "paymentOrder",
        targetId: orderId,
        reason: parsed.data.reason,
        requestId,
      });
    }
    return apiOk({ id: orderId, status, unchanged: result.unchanged, revoked: result.revoked, granted: false }, requestId);
  });
}
