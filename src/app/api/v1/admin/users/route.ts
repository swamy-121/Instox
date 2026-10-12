import { AppError } from "@/lib/errors";
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
    const users = await listUsers(80);
    const entitlementRows = await getDb().select().from(entitlements).limit(200);
    const planByUid = new Map(entitlementRows.map((row) => [row.userId, row]));
    const manage = canManageUsers(actor.roles);
    return apiOk({
      users: users.map((user) => {
        const plan = planByUid.get(user.uid);
        const premium = plan?.status === "active" || plan?.status === "grace";
        return {
          uid: user.uid,
          displayName: user.displayName,
          status: user.status,
          roles: manage ? user.roles : undefined,
          email: manage ? user.email : maskEmail(user.email),
          phoneNumber: manage ? user.phoneNumber : maskPhone(user.phoneNumber),
          createdAt: user.createdAt,
          timezone: user.timezone,
          planId: premium ? String(plan?.planId ?? "premium") : "free",
          planStatus: premium ? String(plan?.status ?? "active") : "free",
        };
      }),
    }, requestId);
  });
}
