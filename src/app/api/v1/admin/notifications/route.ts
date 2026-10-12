import { desc } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { canPublishTips } from "@/server/authorization/roles";
import { assertRecentAuth } from "@/server/authorization/session-policy";
import { getDb } from "@/server/db/client";
import { notificationCampaigns } from "@/server/db/schema";
import { apiOk, readJson, withApi } from "@/server/http";
import { dispatchBroadcast, dispatchTipAlert } from "@/server/notifications/dispatch";
import { getTip } from "@/server/tips/repo";

const tipSchema = z.object({
  tipId: z.string().min(4).max(80),
  kind: z.enum(["transactional", "marketing"]),
  reason: z.string().min(3).max(500),
}).strict();

const broadcastSchema = z.object({
  title: z.string().trim().min(3).max(80),
  message: z.string().trim().min(3).max(240),
  audience: z.enum(["all", "free", "premium"]),
}).strict();

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/notifications", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canPublishTips(actor.roles)) throw new AppError(403, "FORBIDDEN", "You cannot view alerts.");
    const rows = await getDb().select().from(notificationCampaigns).orderBy(desc(notificationCampaigns.createdAt)).limit(50);
    return apiOk({
      campaigns: rows.map((row) => ({
        id: row.id,
        title: row.title ?? row.tipId ?? "Tip alert",
        body: row.body ?? row.reason ?? "",
        audience: row.audience ?? row.kind,
        status: row.status,
        createdAt: row.createdAt,
      })),
    }, requestId);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/notifications", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canPublishTips(actor.roles)) throw new AppError(403, "FORBIDDEN", "You cannot queue tip alerts.");
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
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Send a title and message, or a published tip id.", { title: "Enter a title." });
    const tip = await getTip(parsed.data.tipId);
    if (!tip) throw new AppError(404, "NOT_FOUND", "That tip was not found.");
    if (tip.status !== "published") throw new AppError(422, "BUSINESS_RULE_FAILED", "Only a published tip can be queued for alerts.");
    const result = await dispatchTipAlert({
      tipId: parsed.data.tipId,
      version: tip.version,
      symbol: tip.symbol,
      accessTier: tip.accessTier === "premium" ? "premium" : "free",
      kind: parsed.data.kind,
      actorUid: actor.uid,
      reason: parsed.data.reason,
      requestId,
    });
    return apiOk(result, requestId, null, result.duplicate ? 200 : 201);
  });
}
