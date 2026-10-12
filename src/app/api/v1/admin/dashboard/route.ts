import { AppError } from "@/lib/errors";
import { buildDashboard } from "@/server/admin/metrics";
import { requireActor } from "@/server/auth/actor";
import { canAccessAdmin } from "@/server/authorization/roles";
import { getDb } from "@/server/db/client";
import { entitlements, paymentOrders, tips, users } from "@/server/db/schema";
import { apiOk, withApi } from "@/server/http";

function dayParam(url: URL, key: string, fallback: string): string {
  const value = url.searchParams.get(key) ?? fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError(400, "VALIDATION_ERROR", "Use a YYYY-MM-DD date.", { [key]: "Use a date." });
  return value;
}

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/dashboard", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canAccessAdmin(actor.roles)) throw new AppError(403, "FORBIDDEN", "You do not have admin access.");
    const url = new URL(request.url);
    const today = new Date().toISOString().slice(0, 10);
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 29);
    const from = dayParam(url, "from", start.toISOString().slice(0, 10));
    const to = dayParam(url, "to", today);
    const db = getDb();
    const [userRows, tipRows, orderRows, entitlementRows] = await Promise.all([
      db.select().from(users).limit(300),
      db.select().from(tips).limit(300),
      db.select().from(paymentOrders).limit(300),
      db.select().from(entitlements).limit(300),
    ]);
    const premiumUids = entitlementRows.filter((row) => row.status === "active" || row.status === "grace").map((row) => row.userId);
    const model = buildDashboard({
      from,
      to,
      users: userRows.map((row) => ({ uid: row.id, createdAt: row.createdAt })),
      premiumUids,
      tips: tipRows.map((row) => ({ category: row.category, createdAt: row.createdAt || row.publishedAt || "" })),
      orders: orderRows.map((row) => ({ amountMinor: row.amountMinor, createdAt: row.createdAt })),
    });
    return apiOk(model, requestId);
  });
}
