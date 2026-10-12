import { z } from "zod";
import { AppError } from "@/lib/errors";
import { recordAudit } from "@/server/audit/log";
import { requireOperations } from "@/server/auth/operations";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";
import { reconcilePayments } from "@/server/payments/reconcile";

const bodySchema = z.object({ reason: z.string().min(3).max(500) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/orders/reconcile", async ({ requestId }) => {
    const actor = await requireOperations(request, { recent: true });
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Reconciliation needs a reason.", { reason: "Enter a reason." });
    }
    const db = adminDb();
    const [ordersSnap, eventsSnap] = await Promise.all([
      db.collection("paymentOrders").limit(100).get(),
      db.collection("paymentEvents").limit(200).get(),
    ]);
    const report = reconcilePayments(
      ordersSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          amountMinor: Number(data.amountMinor ?? 0),
          currency: String(data.currency ?? ""),
          status: String(data.status ?? ""),
          createdAt: String(data.createdAt ?? ""),
        };
      }),
      eventsSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          providerEventId: String(data.providerEventId ?? doc.id),
          orderId: data.orderId ? String(data.orderId) : null,
          amountMinor: data.amountMinor == null ? null : Number(data.amountMinor),
          currency: data.currency ? String(data.currency) : null,
          signatureVerified: data.signatureVerified === true,
          eventType: String(data.eventType ?? ""),
        };
      }),
      new Date(),
    );
    await recordAudit({
      actorUid: actor.uid,
      action: "payments.reconciled",
      targetType: "paymentOrders",
      targetId: "batch",
      reason: parsed.data.reason,
      requestId,
    });
    return apiOk({ report }, requestId);
  });
}
