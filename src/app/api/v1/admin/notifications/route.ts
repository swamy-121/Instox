import { z } from "zod";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { requireActor } from "@/server/auth/actor";
import { canPublishTips } from "@/server/authorization/roles";
import { assertRecentAuth } from "@/server/authorization/session-policy";
import { recordAudit } from "@/server/audit/log";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";
import { pushDeliveryPlan, pushIdempotencyKey, safePushPayload, vapidConfigured } from "@/server/notifications/push";

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
    const db = adminDb();
    const tipSnap = await db.collection("tips").doc(parsed.data.tipId).get();
    if (!tipSnap.exists) throw new AppError(404, "NOT_FOUND", "That tip was not found.");
    const tip = tipSnap.data() ?? {};
    if (tip.status !== "published") {
      throw new AppError(422, "BUSINESS_RULE_FAILED", "Only a published tip can be queued for alerts.");
    }
    const accessTier = tip.accessTier === "premium" ? "premium" : "free";
    const payload = safePushPayload({
      symbol: String(tip.symbol ?? ""),
      accessTier,
      tipId: parsed.data.tipId,
    });
    const key = pushIdempotencyKey({
      tipId: parsed.data.tipId,
      version: Number(tip.version ?? 1),
      audience: parsed.data.kind,
      channel: "web_push",
    });
    const campaignRef = db.collection("notificationCampaigns").doc(key);
    const existing = await campaignRef.get();
    if (existing.exists) {
      return apiOk({ duplicate: true, campaign: existing.data() }, requestId);
    }

    const consentField = parsed.data.kind === "marketing" ? "marketingPush" : "tipPush";
    const users = await db.collection("users").where(consentField, "==", true).limit(50).get();
    const configured = vapidConfigured();
    const jobs: Array<Record<string, unknown>> = [];
    const counts = { queued: 0, skipped_unconfigured: 0, skipped_no_consent: 0, skipped_revoked: 0 };
    for (const userDoc of users.docs) {
      const consent = {
        tipPush: userDoc.data().tipPush === true,
        marketingPush: userDoc.data().marketingPush === true,
      };
      const subs = await db.collection("pushSubscriptions").where("uid", "==", userDoc.id).limit(5).get();
      if (subs.empty) continue;
      for (const sub of subs.docs) {
        const plan = pushDeliveryPlan({
          configured,
          consent,
          revoked: sub.data().revoked === true,
          kind: parsed.data.kind,
        });
        counts[plan.status] += 1;
        jobs.push({
          id: createId("job"),
          campaignId: key,
          uid: userDoc.id,
          subscriptionId: sub.id,
          status: plan.status,
          deliver: plan.deliver,
          delivered: false,
          title: payload.title,
          body: payload.body,
          url: payload.url,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const summary = {
      id: key,
      tipId: parsed.data.tipId,
      kind: parsed.data.kind,
      counts,
      configured,
      createdBy: actor.uid,
      createdAt: new Date().toISOString(),
      reason: parsed.data.reason,
    };
    await db.runTransaction(async (tx) => {
      const again = await tx.get(campaignRef);
      if (again.exists) return;
      tx.set(campaignRef, summary);
      for (const job of jobs) {
        tx.set(db.collection("notificationJobs").doc(String(job.id)), job);
      }
    });
    await recordAudit({
      actorUid: actor.uid,
      action: "notification.queued",
      targetType: "tip",
      targetId: parsed.data.tipId,
      reason: parsed.data.reason,
      requestId,
    });
    return apiOk(
      {
        duplicate: false,
        campaign: summary,
        notice: configured
          ? "Alerts are queued locally. This build does not call a push service."
          : "VAPID keys are not set, so nothing was sent.",
      },
      requestId,
      null,
      201,
    );
  });
}
