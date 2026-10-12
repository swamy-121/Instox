import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { assertRecentAuth } from "@/server/authorization/session-policy";
import { apiOk, readJson, withApi } from "@/server/http";
import { requestDeletion } from "@/server/users/repo";

const bodySchema = z.object({ reason: z.string().min(3).max(500) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/account/deletion-requests", async ({ requestId }) => {
    const actor = await requireActor(request, { allowInactive: true });
    if (actor.user.status === "disabled") {
      throw new AppError(403, "ACCOUNT_DISABLED", "This account is disabled.");
    }
    assertRecentAuth(actor.authTime, Date.now());
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Tell us briefly why you want the account removed.", {
        reason: "Enter 3 to 500 characters.",
      });
    }
    const result = await requestDeletion({ uid: actor.uid, reason: parsed.data.reason, requestId });
    return apiOk(
      {
        status: result.status,
        deletionRequestId: result.requestId,
        message: "The deletion request is recorded. Access is paused. Records needed for legal or payment duties are not wiped by this step.",
      },
      requestId,
      null,
      202,
    );
  });
}
