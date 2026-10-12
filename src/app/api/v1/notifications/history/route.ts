import { desc, eq, inArray } from "drizzle-orm";
import { applyPage, inDateRange } from "@/lib/list-page";
import { requireActor } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { alerts, fcmTokens } from "@/server/db/schema";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/notifications/history", async ({ requestId }) => {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const tokens = await getDb().select({ id: fcmTokens.id }).from(fcmTokens).where(eq(fcmTokens.userId, actor.uid));
    const ids = tokens.map((row) => row.id);
    const rows = ids.length === 0
      ? []
      : await getDb().select().from(alerts).where(inArray(alerts.tokenId, ids)).orderBy(desc(alerts.createdAt));
    const status = url.searchParams.get("status") ?? "";
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const matched = rows.filter((row) => {
      if (status && row.status !== status) return false;
      if (!inDateRange(row.createdAt, url.searchParams.get("from"), url.searchParams.get("to"))) return false;
      if (!q) return true;
      return `${row.title} ${row.body} ${row.status}`.toLowerCase().includes(q);
    });
    const window = applyPage(matched, url.searchParams);
    return apiOk({
      alerts: window.items.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        status: row.status,
        url: row.url,
        createdAt: row.createdAt,
      })),
      total: window.total,
      page: window.page,
      pageSize: window.pageSize,
    }, requestId);
  });
}
