import { z } from "zod";
import { AppError } from "@/lib/errors";
import { profileComplete, requireActor } from "@/server/auth/actor";
import { apiOk, readJson, withApi } from "@/server/http";
import { updateOwnProfile } from "@/server/users/repo";

const patchSchema = z
  .object({
    displayName: z.string().optional(),
    locale: z.string().optional(),
    timezone: z.string().optional(),
    consentAccepted: z.boolean().optional(),
  })
  .strict();

function present(actor: Awaited<ReturnType<typeof requireActor>>) {
  return {
    uid: actor.uid,
    displayName: actor.user.displayName,
    email: actor.user.email,
    phoneNumber: actor.user.phoneNumber,
    photoURL: actor.user.photoURL,
    status: actor.user.status,
    locale: actor.user.locale,
    timezone: actor.user.timezone,
    consentVersion: actor.user.consentVersion,
    profileComplete: profileComplete(actor.user),
    providers: actor.user.providers,
    roles: actor.roles,
    entitlement: actor.entitlement,
  };
}

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/me", async ({ requestId }) => {
    const actor = await requireActor(request, { allowInactive: true });
    return apiOk(present(actor), requestId);
  });
}

export async function PATCH(request: Request): Promise<Response> {
  return withApi(request, "PATCH /api/v1/me", async ({ requestId }) => {
    const actor = await requireActor(request);
    const parsed = patchSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Only profile fields can be updated.", {
        form: "Remove roles, status, or entitlement fields.",
      });
    }
    await updateOwnProfile(actor.uid, parsed.data);
    const fresh = await requireActor(request, { allowInactive: true });
    return apiOk(present(fresh), requestId);
  });
}
