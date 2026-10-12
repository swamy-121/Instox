import { z } from "zod";
import { AppError } from "@/lib/errors";
import { recordAudit } from "@/server/audit/log";
import { requireOperations } from "@/server/auth/operations";
import { getDb } from "@/server/db/client";
import { paymentEvents, paymentOrders } from "@/server/db/schema";
import { apiOk, readJson, withApi } from "@/server/http";
import { reconcilePayments } from "@/server/payments/reconcile";

const bodySchema = z.object({ reason: z.string().min(3).max(500) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/orders/reconcile", async ({ requestId }) => {
    const actor = await requireOperations(request, { recent: true });
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Reconciliation needs a reason.", { reason: "Enter a reason." });
    const db = getDb();
    const [orders, events] = await Promise.all([
      db.select().from(paymentOrders).limit(100),
      db.select().from(paymentEvents).limit(200),
    ]);
    const report = reconcilePayments(
      orders.map((row) => ({ id: row.id, amountMinor: row.amountMinor, currency: row.currency, status: row.status, createdAt: row.createdAt })),
      events.map((row) => ({
        providerEventId: row.providerEventId,
        orderId: row.orderId,
        amountMinor: row.amountMinor,
        currency: row.currency,
        signatureVerified: row.signatureVerified,
        eventType: row.eventType,
      })),
      new Date(),
    );
    await recordAudit({ actorUid: actor.uid, action: "payments.reconciled", targetType: "paymentOrders", targetId: "batch", reason: parsed.data.reason, requestId });
    return apiOk({ report }, requestId);
  });
}
