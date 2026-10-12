import { AppError } from "@/lib/errors";
import { maskEmail, maskPhone } from "@/lib/phone";
import { requireActor } from "@/server/auth/actor";
import { canManageUsers, canViewUsers } from "@/server/authorization/roles";
import { apiOk, withApi } from "@/server/http";
import { listUsers } from "@/server/users/repo";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/users", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canViewUsers(actor.roles)) {
      throw new AppError(403, "FORBIDDEN", "You cannot view users.");
    }
    const users = await listUsers(50);
    const manage = canManageUsers(actor.roles);
    return apiOk(
      {
        users: users.map((user) => ({
          uid: user.uid,
          displayName: user.displayName,
          status: user.status,
          roles: manage ? user.roles : undefined,
          email: manage ? user.email : maskEmail(user.email),
          phoneNumber: manage ? user.phoneNumber : maskPhone(user.phoneNumber),
          createdAt: user.createdAt,
          timezone: user.timezone,
        })),
      },
      requestId,
    );
  });
}
