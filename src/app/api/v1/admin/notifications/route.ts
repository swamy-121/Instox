import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { canPublishTips } from "@/server/authorization/roles";
import { assertRecentAuth } from "@/server/authorization/session-policy";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";
import { dispatchTipAlert } from "@/server/notifications/dispatch";

const bodySchema = z
  .object({
    tipId: z.string().min(4).max(80),
    kind: z.enum(["transactional", "marketing"]),
    reason: z.string().min(3).max(500),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/notifications", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canPublishTips(actor.roles)) {
      throw new AppError(403, "FORBIDDEN", "You cannot queue tip alerts.");
    }
    assertRecentAuth(actor.authTime, Date.now());
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "A published tip id, alert kind, and reason are required.", {
        tipId: "Choose a published tip.",
      });
    }
    const tipSnap = await adminDb().collection("tips").doc(parsed.data.tipId).get();
    if (!tipSnap.exists) throw new AppError(404, "NOT_FOUND", "That tip was not found.");
    const tip = tipSnap.data() ?? {};
    if (tip.status !== "published") {
      throw new AppError(422, "BUSINESS_RULE_FAILED", "Only a published tip can be queued for alerts.");
    }
    const result = await dispatchTipAlert({
      tipId: parsed.data.tipId,
      version: Number(tip.version ?? 1),
      symbol: String(tip.symbol ?? ""),
      accessTier: tip.accessTier === "premium" ? "premium" : "free",
      kind: parsed.data.kind,
      actorUid: actor.uid,
      reason: parsed.data.reason,
      requestId,
    });
    return apiOk(result, requestId, null, result.duplicate ? 200 : 201);
  });
}
