import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { assertRecentAuth } from "@/server/authorization/session-policy";
import { apiOk, readJson, withApi } from "@/server/http";
import { setOwnDisabled } from "@/server/users/repo";

const bodySchema = z.object({ reason: z.string().min(3).max(500) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/account/disable", async ({ requestId }) => {
    const actor = await requireActor(request);
    assertRecentAuth(actor.authTime, Date.now());
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "A reason is required.", {
        reason: "Enter 3 to 500 characters.",
      });
    }
    await setOwnDisabled(actor.uid, parsed.data.reason, requestId);
    return apiOk({ status: "disabled" }, requestId);
  });
}
