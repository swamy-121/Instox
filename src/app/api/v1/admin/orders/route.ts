import { desc } from "drizzle-orm";
import { requireOperations } from "@/server/auth/operations";
import { getDb } from "@/server/db/client";
import { paymentOrders } from "@/server/db/schema";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/orders", async ({ requestId }) => {
    await requireOperations(request);
    const rows = await getDb().select().from(paymentOrders).orderBy(desc(paymentOrders.createdAt)).limit(100);
    return apiOk({
      orders: rows.map((row) => ({
        id: row.id,
        uid: row.userId,
        planId: row.planId,
        provider: row.provider,
        amountMinor: row.amountMinor,
        currency: row.currency,
        status: row.status,
        entitlementGranted: row.entitlementGranted,
        createdAt: row.createdAt,
      })),
    }, requestId);
  });
}
