import { AppError } from "@/lib/errors";
import { buildDashboard } from "@/server/admin/metrics";
import { requireActor } from "@/server/auth/actor";
import { canAccessAdmin } from "@/server/authorization/roles";
import { adminDb } from "@/server/db/admin";
import { apiOk, withApi } from "@/server/http";

function dayParam(url: URL, key: string, fallback: string): string {
  const value = url.searchParams.get(key) ?? fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, "VALIDATION_ERROR", "Use a YYYY-MM-DD date.", { [key]: "Use a date." });
  }
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
    const db = adminDb();
    const [users, tips, orders, entitlements] = await Promise.all([
      db.collection("users").limit(300).get(),
      db.collection("tips").limit(300).get(),
      db.collection("paymentOrders").limit(300).get(),
      db.collection("userEntitlements").limit(300).get(),
    ]);
    const premiumUids = entitlements.docs
      .filter((doc) => {
        const status = String(doc.data().status ?? "");
        return status === "active" || status === "grace";
      })
      .map((doc) => doc.id);
    const model = buildDashboard({
      from,
      to,
      users: users.docs.map((doc) => ({ uid: doc.id, createdAt: String(doc.data().createdAt ?? "") })),
      premiumUids,
      tips: tips.docs.map((doc) => ({
        category: String(doc.data().category ?? "equity"),
        createdAt: String(doc.data().createdAt ?? doc.data().publishedAt ?? ""),
      })),
      orders: orders.docs.map((doc) => ({
        amountMinor: Number(doc.data().amountMinor ?? 0),
        createdAt: String(doc.data().createdAt ?? ""),
      })),
    });
    return apiOk(model, requestId);
  });
}
