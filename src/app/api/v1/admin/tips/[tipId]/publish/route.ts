import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { canPublishTips } from "@/server/authorization/roles";
import { assertRecentAuth } from "@/server/authorization/session-policy";
import { apiOk, readJson, requireIdempotencyKey, withApi } from "@/server/http";
import { validateTipInput } from "@/lib/validation/tip";
import { dispatchTipAlert } from "@/server/notifications/dispatch";
import { getTip, publishTip } from "@/server/tips/repo";

const bodySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().min(3).max(500),
    reviewChecklist: z.array(z.string()).min(1),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ tipId: string }> },
): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/tips/:tipId/publish", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canPublishTips(actor.roles)) {
      throw new AppError(403, "FORBIDDEN", "You cannot publish tips.");
    }
    assertRecentAuth(actor.authTime, Date.now());
    const idempotencyKey = requireIdempotencyKey(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Version, checklist, and reason are required.", {
        form: "Complete the publish form.",
      });
    }
    const { tipId } = await context.params;
    const existing = await getTip(tipId);
    if (!existing) throw new AppError(404, "NOT_FOUND", "That tip does not exist.");
    if (existing.status === "in_review") {
      validateTipInput(
        {
          ...existing,
          entryMax: existing.entryMax,
        },
        { forPublish: true },
      );
    }
    const tip = await publishTip({
      tipId,
      expectedVersion: parsed.data.expectedVersion,
      reason: parsed.data.reason,
      checklist: parsed.data.reviewChecklist,
      actorUid: actor.uid,
      requestId,
      idempotencyKey,
    });
    let alertNotice: string | undefined;
    if (tip.status === "published") {
      try {
        const alert = await dispatchTipAlert({
          tipId: tip.id,
          version: tip.version,
          symbol: tip.symbol,
          accessTier: tip.accessTier,
          kind: "transactional",
          actorUid: actor.uid,
          reason: parsed.data.reason,
          requestId,
        });
        alertNotice = alert.notice;
      } catch {
        alertNotice = "The tip was published. The FCM alert could not be queued.";
      }
    }
    return apiOk({ tip, alertNotice }, requestId);
  });
}
