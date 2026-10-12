import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { canPublishTips } from "@/server/authorization/roles";
import { assertRecentAuth } from "@/server/authorization/session-policy";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";
import { dispatchBroadcast, dispatchTipAlert } from "@/server/notifications/dispatch";

const tipSchema = z
  .object({
    tipId: z.string().min(4).max(80),
    kind: z.enum(["transactional", "marketing"]),
    reason: z.string().min(3).max(500),
  })
  .strict();

const broadcastSchema = z
  .object({
    title: z.string().trim().min(3).max(80),
    message: z.string().trim().min(3).max(240),
    audience: z.enum(["all", "free", "premium"]),
  })
  .strict();

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/notifications", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canPublishTips(actor.roles)) throw new AppError(403, "FORBIDDEN", "You cannot view alerts.");
    const snap = await adminDb().collection("notificationCampaigns").limit(50).get();
    const campaigns = snap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: String(data.title ?? data.tipId ?? "Tip alert"),
          body: String(data.body ?? data.reason ?? ""),
          audience: String(data.audience ?? data.kind ?? ""),
          status: String(data.status ?? ""),
          createdAt: String(data.createdAt ?? ""),
        };
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return apiOk({ campaigns }, requestId);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/notifications", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canPublishTips(actor.roles)) {
      throw new AppError(403, "FORBIDDEN", "You cannot queue tip alerts.");
    }
    assertRecentAuth(actor.authTime, Date.now());
    const body = await readJson(request);
    const broadcast = broadcastSchema.safeParse(body);
    if (broadcast.success) {
      const result = await dispatchBroadcast({
        title: broadcast.data.title,
        body: broadcast.data.message,
        audience: broadcast.data.audience,
        actorUid: actor.uid,
        requestId,
      });
      return apiOk(result, requestId, null, 201);
    }
    const parsed = tipSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Send a title and message, or a published tip id.", {
        title: "Enter a title.",
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
