import type { DocumentReference } from "firebase-admin/firestore";
import { getMessaging, type Message } from "firebase-admin/messaging";
import { createId } from "@/lib/ids";
import { recordAudit } from "@/server/audit/log";
import { adminDb, getAdminApp } from "@/server/db/admin";
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

function alreadyExists(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = String((error as { code: unknown }).code);
  return code === "6" || code === "already-exists";
}

type SendRow = { tokenId?: string; ok: boolean; invalid: boolean };

export type TipAlertResult = {
  duplicate: boolean;
  notice: string;
  campaign: { id: string; counts: Record<string, number>; configured: boolean };
};

function toMessage(message: FcmOutbound): Message {
  const data = { title: message.title, body: message.body, url: message.url };
  if (message.topic) return { topic: message.topic, data };
  return { token: message.token ?? "", data };
}

async function sendWithAdmin(messages: FcmOutbound[]): Promise<SendRow[]> {
  if (messages.length === 0) return [];
  const messaging = getMessaging(getAdminApp());
  const rows: SendRow[] = [];
  for (let index = 0; index < messages.length; index += 500) {
    const batch = messages.slice(index, index + 500);
    const response = await messaging.sendEach(batch.map(toMessage));
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
  if (!fcmConfigured() || tokens.length === 0) return;
  const messaging = getMessaging(getAdminApp());
  const tipTopic = FCM_TOPICS.transactional;
  const marketingTopic = FCM_TOPICS.marketing;
  if (consent.tipPush) await messaging.subscribeToTopic(tokens, tipTopic);
  else await messaging.unsubscribeFromTopic(tokens, tipTopic);
  if (consent.marketingPush) await messaging.subscribeToTopic(tokens, marketingTopic);
  else await messaging.unsubscribeFromTopic(tokens, marketingTopic);
}

export async function syncUserTopics(uid: string): Promise<void> {
  if (!fcmConfigured()) return;
  const db = adminDb();
  const [userSnap, tokens] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("fcmTokens").where("uid", "==", uid).limit(20).get(),
  ]);
  const consent = {
    tipPush: userSnap.data()?.tipPush === true,
    marketingPush: userSnap.data()?.marketingPush === true,
  };
  const active = tokens.docs
    .filter((doc) => doc.data().revoked !== true && typeof doc.data().token === "string")
    .map((doc) => String(doc.data().token));
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
  const db = adminDb();
  const payload = safePushPayload({
    symbol: input.symbol,
    accessTier: input.accessTier,
    tipId: input.tipId,
  });
  const key = pushIdempotencyKey({
    tipId: input.tipId,
    version: input.version,
    audience: input.kind,
    channel: "fcm",
  });
  const campaignRef = db.collection("notificationCampaigns").doc(key);
  const existing = await campaignRef.get();
  if (existing.exists) {
    return {
      duplicate: true,
      notice: "This tip alert was already queued.",
      campaign: {
        id: key,
        counts: (existing.data()?.counts as Record<string, number>) ?? {},
        configured: existing.data()?.configured === true,
      },
    };
  }

  const consentField = input.kind === "marketing" ? "marketingPush" : "tipPush";
  const users = await db.collection("users").where(consentField, "==", true).limit(200).get();
  const devices = [];
  for (const userDoc of users.docs) {
    const consent = {
      tipPush: userDoc.data().tipPush === true,
      marketingPush: userDoc.data().marketingPush === true,
    };
    const tokens = await db.collection("fcmTokens").where("uid", "==", userDoc.id).limit(10).get();
    for (const tokenDoc of tokens.docs) {
      const token = tokenDoc.data().token;
      if (typeof token !== "string" || !token) continue;
      devices.push({
        tokenId: tokenDoc.id,
        token,
        revoked: tokenDoc.data().revoked === true,
        consent,
      });
    }
  }

  const configured = fcmConfigured();
  const plan = buildFcmDeliveries({
    devices,
    kind: input.kind,
    payload,
    configured,
    mode: fcmSendMode(),
  });
  const now = new Date().toISOString();
  try {
    await campaignRef.create({
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
    if (!alreadyExists(error)) throw error;
    return {
      duplicate: true,
      notice: "This tip alert was already queued.",
      campaign: { id: key, counts: plan.counts, configured },
    };
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
    if (plan.messages.some((message) => message.topic)) {
      return { ...job, finalStatus: topicOk ? "sent" : "failed" };
    }
    const row = byToken.get(job.tokenId);
    return { ...job, finalStatus: row?.ok ? "sent" : "failed" };
  });
  const counts = {
    ...plan.counts,
    sent: jobs.filter((job) => job.finalStatus === "sent").length,
    failed: jobs.filter((job) => job.finalStatus === "failed").length,
  };

  const writes: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [
    {
      ref: campaignRef,
      data: {
        id: key,
        tipId: input.tipId,
        kind: input.kind,
        channel: "fcm",
        status: counts.failed > 0 ? "failed" : "sent",
        configured,
        counts,
        createdBy: input.actorUid,
        createdAt: now,
        updatedAt: now,
        reason: input.reason,
      },
    },
  ];
  for (const job of jobs) {
    const id = createId("job");
    writes.push({
      ref: db.collection("notificationJobs").doc(id),
      data: {
        id,
        campaignId: key,
        tokenId: job.tokenId,
        status: job.finalStatus,
        title: payload.title,
        body: payload.body,
        url: payload.url,
        createdAt: now,
      },
    });
  }
  for (let index = 0; index < writes.length; index += 400) {
    const batch = db.batch();
    for (const write of writes.slice(index, index + 400)) {
      batch.set(write.ref, write.data, { merge: true });
    }
    await batch.commit();
  }

  const invalidIds = rows.filter((row) => row.invalid && row.tokenId).map((row) => row.tokenId as string);
  await Promise.all(
    invalidIds.map((id) => db.collection("fcmTokens").doc(id).set({ revoked: true, updatedAt: now }, { merge: true })),
  );

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
  const db = adminDb();
  const id = createId("camp");
  const campaignRef = db.collection("notificationCampaigns").doc(id);
  const entitlements = await db.collection("userEntitlements").limit(300).get();
  const premium = new Set(
    entitlements.docs
      .filter((doc) => doc.data().status === "active" || doc.data().status === "grace")
      .map((doc) => doc.id),
  );
  const users = await db.collection("users").where("tipPush", "==", true).limit(200).get();
  const devices = [];
  for (const userDoc of users.docs) {
    const isPremium = premium.has(userDoc.id);
    if (input.audience === "premium" && !isPremium) continue;
    if (input.audience === "free" && isPremium) continue;
    const tokens = await db.collection("fcmTokens").where("uid", "==", userDoc.id).limit(10).get();
    for (const tokenDoc of tokens.docs) {
      const token = tokenDoc.data().token;
      if (typeof token !== "string" || !token) continue;
      devices.push({
        tokenId: tokenDoc.id,
        token,
        revoked: tokenDoc.data().revoked === true,
        consent: { tipPush: true, marketingPush: userDoc.data().marketingPush === true },
      });
    }
  }
  const configured = fcmConfigured();
  const payload = { title: input.title, body: input.body, url: "/home" };
  const plan = buildFcmDeliveries({
    devices,
    kind: "transactional",
    payload,
    configured,
    mode: fcmSendMode(),
  });
  const now = new Date().toISOString();
  await campaignRef.set({
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
      await campaignRef.set({ status: "failed" }, { merge: true });
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
