import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { canEditTips, canPublishTips } from "@/server/authorization/roles";
import { apiOk, readJson, withApi } from "@/server/http";
import { validateTipInput } from "@/lib/validation/tip";
import { getTip, listTipEvents, updateTipContent } from "@/server/tips/repo";

const patchSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().min(3).max(500),
    tip: z.unknown(),
  })
  .strict();

export async function GET(
  request: Request,
  context: { params: Promise<{ tipId: string }> },
): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/tips/:tipId", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canEditTips(actor.roles)) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to this tip.");
    }
    const { tipId } = await context.params;
    const tip = await getTip(tipId);
    if (!tip) throw new AppError(404, "NOT_FOUND", "That tip does not exist.");
    const events = await listTipEvents(tipId);
    return apiOk({ tip, events }, requestId);
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tipId: string }> },
): Promise<Response> {
  return withApi(request, "PATCH /api/v1/admin/tips/:tipId", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canEditTips(actor.roles)) {
      throw new AppError(403, "FORBIDDEN", "You cannot edit tips.");
    }
    const parsed = patchSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Expected version, reason, and tip fields are required.", {
        form: "Check the editor payload.",
      });
    }
    const { tipId } = await context.params;
    const existing = await getTip(tipId);
    if (!existing) throw new AppError(404, "NOT_FOUND", "That tip does not exist.");
    if (existing.status === "published" && !canPublishTips(actor.roles)) {
      throw new AppError(403, "FORBIDDEN", "Only a publisher can correct a published tip.");
    }
    if (existing.status !== "draft" && existing.status !== "in_review" && existing.status !== "published") {
      throw new AppError(409, "STATE_CONFLICT", "This tip can no longer be edited.");
    }
    const tip = validateTipInput(parsed.data.tip, { forPublish: existing.status === "published" });
    const updated = await updateTipContent({
      tipId,
      tip,
      expectedVersion: parsed.data.expectedVersion,
      reason: parsed.data.reason,
      actorUid: actor.uid,
      requestId,
    });
    return apiOk({ tip: updated }, requestId);
  });
}
