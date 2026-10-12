import { AppError } from "@/lib/errors";
import { applyPage, inDateRange } from "@/lib/list-page";
import { maskEmail, maskPhone } from "@/lib/phone";
import { requireActor } from "@/server/auth/actor";
import { canManageUsers, canViewUsers } from "@/server/authorization/roles";
import { getDb } from "@/server/db/client";
import { entitlements } from "@/server/db/schema";
import { apiOk, withApi } from "@/server/http";
import { listUsers } from "@/server/users/repo";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/users", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canViewUsers(actor.roles)) throw new AppError(403, "FORBIDDEN", "You cannot view users.");
    const url = new URL(request.url);
    const users = await listUsers(5000);
    const entitlementRows = await getDb().select().from(entitlements);
    const planByUid = new Map(entitlementRows.map((row) => [row.userId, row]));
    const manage = canManageUsers(actor.roles);
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const status = url.searchParams.get("status") ?? "";
    const plan = url.searchParams.get("plan") ?? "";
    const mapped = users.map((user) => {
      const entitlement = planByUid.get(user.uid);
      const premium = entitlement?.status === "active" || entitlement?.status === "grace";
      return {
        uid: user.uid,
        displayName: user.displayName,
        status: user.status,
        roles: manage ? user.roles : undefined,
        email: manage ? user.email : maskEmail(user.email),
        phoneNumber: manage ? user.phoneNumber : maskPhone(user.phoneNumber),
        createdAt: user.createdAt,
        timezone: user.timezone,
        planId: premium ? String(entitlement?.planId ?? "premium") : "free",
        planStatus: premium ? String(entitlement?.status ?? "active") : "free",
      };
    }).filter((user) => {
      if (status && user.status !== status) return false;
      if (!inDateRange(user.createdAt, url.searchParams.get("from"), url.searchParams.get("to"))) return false;
      if (!q) return true;
      return `${user.displayName} ${user.email ?? ""} ${user.phoneNumber ?? ""} ${user.uid}`.toLowerCase().includes(q);
    });
    const counts = {
      all: mapped.length,
      free: mapped.filter((user) => user.planId === "free").length,
      premium: mapped.filter((user) => user.planId !== "free").length,
    };
    const narrowed = mapped.filter((user) => {
      if (plan === "free") return user.planId === "free";
      if (plan === "premium") return user.planId !== "free";
      return true;
    });
    const window = applyPage(narrowed, url.searchParams);
    return apiOk({ users: window.items, counts, total: window.total, page: window.page, pageSize: window.pageSize }, requestId);
  });
}
