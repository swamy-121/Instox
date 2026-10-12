import { eq } from "drizzle-orm";
import { createId } from "@/lib/ids";
import { recordAudit } from "@/server/audit/log";
import { getDb } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/sql-error";
import { alerts, entitlements, fcmTokens, notificationCampaigns, users } from "@/server/db/schema";
import { refreshIntegrations } from "@/server/integrations/store";
import { getFcmMessaging } from "@/server/notifications/firebase-app";
import {
  FCM_TOPICS,
  buildFcmDeliveries,
  fcmConfigured,
  fcmSendMode,
  pushIdempotencyKey,
  safePushPayload,
  type FcmOutbound,
  type PushConsent,
} from "@/server/notifications/push";

const INVALID_TOKEN = new Set(["messaging/invalid-registration-token", "messaging/registration-token-not-registered"]);

type SendRow = { tokenId?: string; ok: boolean; invalid: boolean };

export type TipAlertResult = {
  duplicate: boolean;
  notice: string;
  campaign: { id: string; counts: Record<string, number>; configured: boolean };
};

async function sendWithAdmin(messages: FcmOutbound[]): Promise<SendRow[]> {
  if (messages.length === 0) return [];
  const messaging = await getFcmMessaging();
  if (!messaging) return messages.map((message) => ({ tokenId: message.tokenId, ok: false, invalid: false }));
  const rows: SendRow[] = [];
  for (let index = 0; index < messages.length; index += 500) {
    const batch = messages.slice(index, index + 500);
    const response = await messaging.sendEach(
      batch.map((message) => {
        const data = { title: message.title, body: message.body, url: message.url };
        return message.topic ? { topic: message.topic, data } : { token: message.token ?? "", data };
      }),
    );
    response.responses.forEach((item, itemIndex) => {
      const code = item.error?.code ?? "";
      rows.push({
        tokenId: batch[itemIndex]?.tokenId,
        ok: item.success,
        invalid: !item.success && INVALID_TOKEN.has(code),
      });
    });
  }
  return rows;
}

async function syncTopics(tokens: string[], consent: PushConsent): Promise<void> {
  await refreshIntegrations();
  if (!fcmConfigured() || tokens.length === 0) return;
  const messaging = await getFcmMessaging();
  if (!messaging) return;
  const tipTopic = FCM_TOPICS.transactional;
  const marketingTopic = FCM_TOPICS.marketing;
  if (consent.tipPush) await messaging.subscribeToTopic(tokens, tipTopic);
  else await messaging.unsubscribeFromTopic(tokens, tipTopic);
  if (consent.marketingPush) await messaging.subscribeToTopic(tokens, marketingTopic);
  else await messaging.unsubscribeFromTopic(tokens, marketingTopic);
}

export async function syncUserTopics(uid: string): Promise<void> {
  await refreshIntegrations();
  if (!fcmConfigured()) return;
  const db = getDb();
  const [userRows, tokens] = await Promise.all([
    db.select().from(users).where(eq(users.id, uid)).limit(1),
    db.select().from(fcmTokens).where(eq(fcmTokens.userId, uid)).limit(20),
  ]);
  const user = userRows[0];
  const consent = { tipPush: user?.tipPush === true, marketingPush: user?.marketingPush === true };
  const active = tokens.filter((row) => !row.revoked && row.token).map((row) => row.token);
  await syncTopics(active, consent);
}

export async function dispatchTipAlert(input: {
  tipId: string;
  version: number;
  symbol: string;
  accessTier: "free" | "premium";
  kind: "transactional" | "marketing";
  actorUid: string;
  reason: string;
  requestId: string;
}): Promise<TipAlertResult> {
  await refreshIntegrations();
  const db = getDb();
  const payload = safePushPayload({ symbol: input.symbol, accessTier: input.accessTier, tipId: input.tipId });
  const key = pushIdempotencyKey({ tipId: input.tipId, version: input.version, audience: input.kind, channel: "fcm" });
  const existing = await db.select().from(notificationCampaigns).where(eq(notificationCampaigns.id, key)).limit(1);
  if (existing[0]) {
    return {
      duplicate: true,
      notice: "This tip alert was already queued.",
      campaign: { id: key, counts: (existing[0].counts as Record<string, number>) ?? {}, configured: existing[0].configured === true },
    };
  }

  const consentField = input.kind === "marketing" ? users.marketingPush : users.tipPush;
  const consented = await db.select().from(users).where(eq(consentField, true)).limit(200);
  const devices = [];
  for (const user of consented) {
    const consent = { tipPush: user.tipPush, marketingPush: user.marketingPush };
    const tokens = await db.select().from(fcmTokens).where(eq(fcmTokens.userId, user.id)).limit(10);
    for (const tokenRow of tokens) {
      if (!tokenRow.token) continue;
      devices.push({ tokenId: tokenRow.id, token: tokenRow.token, revoked: tokenRow.revoked, consent });
    }
  }

  const configured = fcmConfigured();
  const plan = buildFcmDeliveries({ devices, kind: input.kind, payload, configured, mode: fcmSendMode() });
  const now = new Date().toISOString();
  try {
    await db.insert(notificationCampaigns).values({
      id: key,
      tipId: input.tipId,
      kind: input.kind,
      channel: "fcm",
      status: "pending",
      configured,
      counts: plan.counts,
      createdBy: input.actorUid,
      createdAt: now,
      reason: input.reason,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return { duplicate: true, notice: "This tip alert was already queued.", campaign: { id: key, counts: plan.counts, configured } };
  }

  let rows: SendRow[] = [];
  let notice = configured ? "FCM accepted the alert." : "FCM is not configured, so nothing was sent.";
  if (plan.messages.length > 0) {
    try {
      rows = await sendWithAdmin(plan.messages);
      const failed = rows.filter((row) => !row.ok).length;
      notice = failed === 0 ? "FCM accepted the alert." : "FCM rejected part of the alert.";
    } catch {
      rows = plan.messages.map((message) => ({ tokenId: message.tokenId, ok: false, invalid: false }));
      notice = "FCM rejected the alert.";
    }
  }

  const topicOk = plan.messages.some((message) => message.topic) ? rows[0]?.ok === true : false;
  const byToken = new Map(rows.filter((row) => row.tokenId).map((row) => [row.tokenId, row]));
  const jobs = plan.jobs.map((job) => {
    if (job.status !== "queued") return { ...job, finalStatus: job.status };
    if (plan.messages.some((message) => message.topic)) return { ...job, finalStatus: topicOk ? "sent" : "failed" };
    const row = byToken.get(job.tokenId);
    return { ...job, finalStatus: row?.ok ? "sent" : "failed" };
  });
  const counts = {
    ...plan.counts,
    sent: jobs.filter((job) => job.finalStatus === "sent").length,
    failed: jobs.filter((job) => job.finalStatus === "failed").length,
  };

  await db.update(notificationCampaigns).set({
    status: counts.failed > 0 ? "failed" : "sent",
    counts,
    updatedAt: now,
  }).where(eq(notificationCampaigns.id, key));
  if (jobs.length > 0) {
    await db.insert(alerts).values(
      jobs.map((job) => ({
        id: createId("job"),
        campaignId: key,
        tokenId: job.tokenId,
        status: job.finalStatus,
        title: payload.title,
        body: payload.body,
        url: payload.url,
        createdAt: now,
      })),
    );
  }

  const invalidIds = rows.filter((row) => row.invalid && row.tokenId).map((row) => row.tokenId as string);
  await Promise.all(invalidIds.map((id) => db.update(fcmTokens).set({ revoked: true, updatedAt: now }).where(eq(fcmTokens.id, id))));

  await recordAudit({
    actorUid: input.actorUid,
    action: "notification.queued",
    targetType: "tip",
    targetId: input.tipId,
    reason: input.reason,
    requestId: input.requestId,
  });

  return { duplicate: false, notice, campaign: { id: key, counts, configured } };
}

export async function dispatchBroadcast(input: {
  title: string;
  body: string;
  audience: "all" | "free" | "premium";
  actorUid: string;
  requestId: string;
}): Promise<TipAlertResult> {
  await refreshIntegrations();
  const db = getDb();
  const id = createId("camp");
  const entitlementRows = await db.select().from(entitlements).limit(300);
  const premium = new Set(entitlementRows.filter((row) => row.status === "active" || row.status === "grace").map((row) => row.userId));
  const consented = await db.select().from(users).where(eq(users.tipPush, true)).limit(200);
  const devices = [];
  for (const user of consented) {
    const isPremium = premium.has(user.id);
    if (input.audience === "premium" && !isPremium) continue;
    if (input.audience === "free" && isPremium) continue;
    const tokens = await db.select().from(fcmTokens).where(eq(fcmTokens.userId, user.id)).limit(10);
    for (const tokenRow of tokens) {
      if (!tokenRow.token) continue;
      devices.push({
        tokenId: tokenRow.id,
        token: tokenRow.token,
        revoked: tokenRow.revoked,
        consent: { tipPush: true, marketingPush: user.marketingPush },
      });
    }
  }
  const configured = fcmConfigured();
  const payload = { title: input.title, body: input.body, url: "/home" };
  const plan = buildFcmDeliveries({ devices, kind: "transactional", payload, configured, mode: fcmSendMode() });
  const now = new Date().toISOString();
  await db.insert(notificationCampaigns).values({
    id,
    title: input.title,
    body: input.body,
    audience: input.audience,
    kind: "broadcast",
    channel: "fcm",
    status: configured && plan.messages.length > 0 ? "pending" : "skipped_unconfigured",
    configured,
    counts: plan.counts,
    createdBy: input.actorUid,
    createdAt: now,
    reason: input.body,
  });
  let notice = configured ? "FCM accepted the message." : "FCM is not configured, so the message was saved and nothing was sent.";
  if (plan.messages.length > 0) {
    try {
      await sendWithAdmin(plan.messages);
    } catch {
      notice = "The message was saved. FCM did not accept the send.";
      await db.update(notificationCampaigns).set({ status: "failed" }).where(eq(notificationCampaigns.id, id));
    }
  }
  await recordAudit({
    actorUid: input.actorUid,
    action: "notification.queued",
    targetType: "campaign",
    targetId: id,
    reason: input.title,
    requestId: input.requestId,
  });
  return { duplicate: false, notice, campaign: { id, counts: plan.counts, configured } };
}
