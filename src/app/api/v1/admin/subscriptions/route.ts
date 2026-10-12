import { maskPhone } from "@/lib/phone";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { canManageUsers, canViewUsers } from "@/server/authorization/roles";
import { adminDb } from "@/server/db/admin";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/subscriptions", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canViewUsers(actor.roles)) throw new AppError(403, "FORBIDDEN", "You cannot view subscriptions.");
    const manage = canManageUsers(actor.roles);
    const db = adminDb();
    const [entitlements, users, plans] = await Promise.all([
      db.collection("userEntitlements").limit(200).get(),
      db.collection("users").limit(300).get(),
      db.collection("plans").limit(50).get(),
    ]);
    const userById = new Map(users.docs.map((doc) => [doc.id, doc.data()]));
    const planById = new Map(plans.docs.map((doc) => [doc.id, doc.data()]));
    const subscriptions = entitlements.docs
      .map((doc) => {
        const data = doc.data();
        const user = userById.get(doc.id);
        const planId = String(data.planId ?? "");
        const plan = planById.get(planId);
        const phone = user?.phoneNumber ? String(user.phoneNumber) : null;
        return {
          uid: doc.id,
          displayName: String(user?.displayName ?? doc.id),
          phoneNumber: manage ? phone : maskPhone(phone),
          planId,
          planName: String(plan?.name ?? planId),
          amountMinor: Number(plan?.priceMinor ?? 0),
          currency: String(plan?.currency ?? "INR"),
          status: String(data.status ?? ""),
          startsAt: String(data.startsAt ?? ""),
          endsAt: String(data.endsAt ?? ""),
        };
      })
      .sort((left, right) => right.startsAt.localeCompare(left.startsAt));
    return apiOk({ subscriptions }, requestId);
  });
}
