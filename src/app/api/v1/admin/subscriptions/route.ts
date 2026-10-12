import { applyPage, inDateRange } from "@/lib/list-page";
import { maskPhone } from "@/lib/phone";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { canManageUsers, canViewUsers } from "@/server/authorization/roles";
import { listContent } from "@/server/content/store";
import { getDb } from "@/server/db/client";
import { entitlements, users } from "@/server/db/schema";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/subscriptions", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canViewUsers(actor.roles)) throw new AppError(403, "FORBIDDEN", "You cannot view subscriptions.");
    const manage = canManageUsers(actor.roles);
    const db = getDb();
    const url = new URL(request.url);
    const [entitlementRows, userRows, plans] = await Promise.all([
      db.select().from(entitlements),
      db.select().from(users),
      listContent("plans", "admin"),
    ]);
    const userById = new Map(userRows.map((row) => [row.id, row]));
    const planById = new Map(plans.map((plan) => [plan.id, plan]));
    const subscriptions = entitlementRows
      .map((row) => {
        const user = userById.get(row.userId);
        const planId = row.planId ?? "";
        const plan = planById.get(planId);
        const phone = user?.phoneNumber ?? null;
        return {
          uid: row.userId,
          displayName: user?.displayName ?? row.userId,
          phoneNumber: manage ? phone : maskPhone(phone),
          planId,
          planName: plan?.name ?? planId,
          amountMinor: plan?.priceMinor ?? 0,
          currency: plan?.currency ?? "INR",
          status: row.status,
          startsAt: row.startsAt ?? "",
          endsAt: row.endsAt ?? "",
        };
      })
      .sort((left, right) => right.startsAt.localeCompare(left.startsAt));
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const plan = url.searchParams.get("plan") ?? "";
    const searched = subscriptions.filter((row) => {
      if (plan && row.planId !== plan) return false;
      if (!inDateRange(row.startsAt, url.searchParams.get("from"), url.searchParams.get("to"))) return false;
      if (!q) return true;
      return `${row.displayName} ${row.phoneNumber ?? ""} ${row.planName} ${row.planId}`.toLowerCase().includes(q);
    });
    function bucket(status: string): string {
      if (status === "active" || status === "grace") return "active";
      if (status === "expired") return "expired";
      if (status === "revoked") return "cancelled";
      return "other";
    }
    const status = url.searchParams.get("status") ?? "";
    const counts = {
      all: searched.length,
      active: searched.filter((row) => bucket(row.status) === "active").length,
      expired: searched.filter((row) => bucket(row.status) === "expired").length,
      cancelled: searched.filter((row) => bucket(row.status) === "cancelled").length,
    };
    const narrowed = status && status !== "all" ? searched.filter((row) => bucket(row.status) === status) : searched;
    const window = applyPage(narrowed, url.searchParams);
    return apiOk({ subscriptions: window.items, counts, plans: plans.map((item) => ({ id: item.id, name: item.name })), total: window.total, page: window.page, pageSize: window.pageSize }, requestId);
  });
}
