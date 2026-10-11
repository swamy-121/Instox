import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { canManageUsers } from "@/server/authorization/roles";
import { assertRecentAuth } from "@/server/authorization/session-policy";
import { apiOk, readJson, withApi } from "@/server/http";
import { updateUserRoles, updateUserStatus } from "@/server/users/repo";
import { ROLES, USER_STATUSES } from "@/types/domain";

const bodySchema = z
  .object({
    roles: z.array(z.enum(ROLES)).optional(),
    status: z.enum(USER_STATUSES).optional(),
    reason: z.string().min(3).max(500),
  })
  .strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ uid: string }> },
): Promise<Response> {
  return withApi(request, "PATCH /api/v1/admin/users/:uid", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canManageUsers(actor.roles)) {
      throw new AppError(403, "FORBIDDEN", "You cannot change users.");
    }
    assertRecentAuth(actor.authTime, Date.now());
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Role or status changes need a reason.", {
        reason: "Enter a reason.",
      });
    }
    const { uid } = await context.params;
    if (!parsed.data.roles && !parsed.data.status) {
      throw new AppError(400, "VALIDATION_ERROR", "Send roles or a status.", { form: "Nothing to change." });
    }
    const roles = parsed.data.roles
      ? await updateUserRoles({
          actorUid: actor.uid,
          actorRoles: actor.roles,
          targetUid: uid,
          roles: parsed.data.roles,
          reason: parsed.data.reason,
          requestId,
        })
      : undefined;
    if (parsed.data.status) {
      await updateUserStatus({
        actorUid: actor.uid,
        targetUid: uid,
        status: parsed.data.status,
        reason: parsed.data.reason,
        requestId,
      });
    }
    return apiOk({ uid, roles, status: parsed.data.status ?? null }, requestId);
  });
}
