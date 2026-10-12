import { z } from "zod";
import { AppError } from "@/lib/errors";
import { recordAudit } from "@/server/audit/log";
import { requireOperations } from "@/server/auth/operations";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";
import { parseAdminOrderStatus } from "@/server/payments/order-admin";

const bodySchema = z.object({
  status: z.string(),
  reason: z.string().trim().min(3).max(500),
}).strict();

type Params = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, { params }: Params): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/orders/[orderId]", async ({ requestId }) => {
    const actor = await requireOperations(request, { recent: true });
    const { orderId } = await params;
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(orderId)) {
      throw new AppError(404, "NOT_FOUND", "That order was not found.");
    }
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "A status and a reason are required.", {
        reason: "Enter a reason.",
      });
    }
    const status = parseAdminOrderStatus(parsed.data.status);
    const db = adminDb();
    const result = await db.runTransaction(async (tx) => {
      const orderRef = db.collection("paymentOrders").doc(orderId);
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) throw new AppError(404, "NOT_FOUND", "That order was not found.");
      const data = orderSnap.data() ?? {};
      const uid = String(data.uid ?? "");
      const entitlementRef = db.collection("userEntitlements").doc(uid);
      const subscriptionRef = db.collection("subscriptions").doc(orderId);
      const entitlementSnap = await tx.get(entitlementRef);
      const subscriptionSnap = await tx.get(subscriptionRef);
      const now = new Date().toISOString();
      const entitlement = entitlementSnap.data();
      const revoke =
        (status === "refunded" || status === "disputed") &&
        entitlement?.source === "payment" &&
        entitlement?.sourceOrderId === orderId;
      const unchanged = String(data.status ?? "") === status && !revoke;
      if (!unchanged) {
        tx.update(orderRef, {
          status,
          statusReason: parsed.data.reason,
          statusUpdatedBy: actor.uid,
          updatedAt: now,
        });
        if (subscriptionSnap.exists) {
          const subscriptionStatus = status === "failed" ? "cancelled" : status;
          tx.set(subscriptionRef, { status: subscriptionStatus, updatedAt: now }, { merge: true });
        }
        if (revoke) {
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
      }
      return { unchanged, revoked: revoke, uid };
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
    return apiOk(
      {
        id: orderId,
        status,
        unchanged: result.unchanged,
        revoked: result.revoked,
        granted: false,
      },
      requestId,
    );
  });
}
