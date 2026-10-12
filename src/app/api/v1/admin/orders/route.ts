import { desc } from "drizzle-orm";
import { applyPage, inDateRange } from "@/lib/list-page";
import { requireOperations } from "@/server/auth/operations";
import { getDb } from "@/server/db/client";
import { paymentOrders } from "@/server/db/schema";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/orders", async ({ requestId }) => {
    await requireOperations(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "";
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const rows = await getDb().select().from(paymentOrders).orderBy(desc(paymentOrders.createdAt));
    const matched = rows.filter((row) => {
      if (status && row.status !== status) return false;
      if (!inDateRange(row.createdAt, url.searchParams.get("from"), url.searchParams.get("to"))) return false;
      if (!q) return true;
      return `${row.id} ${row.userId} ${row.planId} ${row.provider} ${row.status}`.toLowerCase().includes(q);
    });
    const window = applyPage(matched, url.searchParams);
    return apiOk({
      orders: window.items.map((row) => ({
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
      total: window.total,
      page: window.page,
      pageSize: window.pageSize,
    }, requestId);
  });
}
