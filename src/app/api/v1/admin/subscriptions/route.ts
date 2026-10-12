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
    const [entitlementRows, userRows, plans] = await Promise.all([
      db.select().from(entitlements).limit(200),
      db.select().from(users).limit(300),
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
    return apiOk({ subscriptions }, requestId);
  });
}
