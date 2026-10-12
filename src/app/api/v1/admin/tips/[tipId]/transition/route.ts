import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { canEditTips, canPublishTips } from "@/server/authorization/roles";
import { apiOk, readJson, withApi } from "@/server/http";
import { validateTipInput } from "@/lib/validation/tip";
import { getTip, transitionTip } from "@/server/tips/repo";
import { CLOSE_REASONS } from "@/types/domain";

const bodySchema = z
  .object({
    action: z.enum(["submit_review", "return_to_draft", "close", "cancel", "expire"]),
    expectedVersion: z.number().int().positive(),
    reason: z.string().max(500).optional(),
    closeReason: z.enum(CLOSE_REASONS).nullable().optional(),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ tipId: string }> },
): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/tips/:tipId/transition", async ({ requestId }) => {
    const actor = await requireActor(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "That transition is not valid.", {
        action: "Choose a supported action.",
      });
    }
    const { tipId } = await context.params;
    const existing = await getTip(tipId);
    if (!existing) throw new AppError(404, "NOT_FOUND", "That tip does not exist.");

    const action = parsed.data.action;
    if (action === "submit_review") {
      if (!canEditTips(actor.roles)) throw new AppError(403, "FORBIDDEN", "You cannot submit tips for review.");
      validateTipInput(existing, { forPublish: false });
    } else if (!canPublishTips(actor.roles)) {
      const ownDraftCancel = action === "cancel" && canEditTips(actor.roles) && existing.createdBy === actor.uid && existing.status === "draft";
      if (!ownDraftCancel) {
        throw new AppError(403, "FORBIDDEN", "You cannot change this tip's state.");
      }
    }

    const tip = await transitionTip({
      tipId,
      action,
      reason: parsed.data.reason ?? "",
      closeReason: parsed.data.closeReason ?? null,
      expectedVersion: parsed.data.expectedVersion,
      actorUid: actor.uid,
      requestId,
    });
    return apiOk({ tip }, requestId);
  });
}
