import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { getDb } from "@/server/db/client";
import { memberAlerts, savedTips, tipAlertPrefs, tipChecks, trackedTips } from "@/server/db/schema";
import { zonedDayStart } from "@/server/insights/report";
import { DEFAULT_ALERT_PREFS, type AlertPrefs } from "@/server/tips/evaluate";
import { getTip, getTipsByIds } from "@/server/tips/repo";
import type { TipRecord } from "@/types/domain";

export async function setSaved(userId: string, tipId: string, saved: boolean): Promise<{ saved: boolean }> {
  await requireTip(tipId);
  const db = getDb();
  if (!saved) {
    await db.delete(savedTips).where(and(eq(savedTips.userId, userId), eq(savedTips.tipId, tipId)));
    return { saved: false };
  }
  await db.insert(savedTips).values({ userId, tipId, createdAt: new Date().toISOString() }).onConflictDoNothing();
  return { saved: true };
}

export async function setTracked(userId: string, tipId: string, tracked: boolean): Promise<{ tracked: boolean }> {
  await requireTip(tipId);
  const db = getDb();
  if (!tracked) {
    await db.delete(trackedTips).where(and(eq(trackedTips.userId, userId), eq(trackedTips.tipId, tipId)));
    return { tracked: false };
  }
  await db.insert(trackedTips).values({ userId, tipId, createdAt: new Date().toISOString() }).onConflictDoNothing();
  return { tracked: true };
}

export async function libraryFlags(userId: string, tipId: string): Promise<{ saved: boolean; tracked: boolean }> {
  const db = getDb();
  const [saved, tracked] = await Promise.all([
    db.select().from(savedTips).where(and(eq(savedTips.userId, userId), eq(savedTips.tipId, tipId))).limit(1),
    db.select().from(trackedTips).where(and(eq(trackedTips.userId, userId), eq(trackedTips.tipId, tipId))).limit(1),
  ]);
  return { saved: Boolean(saved[0]), tracked: Boolean(tracked[0]) };
}

export async function listSaved(userId: string): Promise<TipRecord[]> {
  const rows = await getDb().select().from(savedTips).where(eq(savedTips.userId, userId)).orderBy(desc(savedTips.createdAt));
  const tips = await getTipsByIds(rows.map((row) => row.tipId));
  const order = new Map(rows.map((row, index) => [row.tipId, index]));
  return tips.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function savedSymbols(userId: string): Promise<string[]> {
  const tips = await listSaved(userId);
  return [...new Set(tips.map((tip) => tip.symbol))];
}

export async function listTracked(userId: string): Promise<TipRecord[]> {
  const rows = await getDb().select().from(trackedTips).where(eq(trackedTips.userId, userId)).orderBy(desc(trackedTips.createdAt));
  const tips = await getTipsByIds(rows.map((row) => row.tipId));
  const order = new Map(rows.map((row, index) => [row.tipId, index]));
  return tips.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function readAlertPrefs(userId: string): Promise<AlertPrefs> {
  const rows = await getDb().select().from(tipAlertPrefs).where(eq(tipAlertPrefs.userId, userId)).limit(1);
  const row = rows[0];
  if (!row) return { ...DEFAULT_ALERT_PREFS };
  return { targetHit: row.targetHit, stopLoss: row.stopLoss, expired: row.expired };
}

export async function writeAlertPrefs(userId: string, prefs: AlertPrefs): Promise<AlertPrefs> {
  const now = new Date().toISOString();
  await getDb()
    .insert(tipAlertPrefs)
    .values({ userId, targetHit: prefs.targetHit, stopLoss: prefs.stopLoss, expired: prefs.expired, updatedAt: now })
    .onConflictDoUpdate({
      target: tipAlertPrefs.userId,
      set: { targetHit: prefs.targetHit, stopLoss: prefs.stopLoss, expired: prefs.expired, updatedAt: now },
    });
  return prefs;
}

export async function listMemberAlerts(userId: string): Promise<Array<{
  id: string;
  tipId: string | null;
  kind: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}>> {
  const rows = await getDb().select().from(memberAlerts).where(eq(memberAlerts.userId, userId)).orderBy(desc(memberAlerts.createdAt)).limit(40);
  return rows.map((row) => ({
    id: row.id,
    tipId: row.tipId,
    kind: row.kind,
    title: row.title,
    body: row.body,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }));
}

export async function markAlertRead(userId: string, alertId: string): Promise<void> {
  await getDb()
    .update(memberAlerts)
    .set({ readAt: new Date().toISOString() })
    .where(and(eq(memberAlerts.id, alertId), eq(memberAlerts.userId, userId)));
}

export async function checksUsedToday(userId: string, now = new Date()): Promise<number> {
  const since = zonedDayStart(now).toISOString();
  const rows = await getDb().select({ id: tipChecks.id }).from(tipChecks).where(and(eq(tipChecks.userId, userId), gte(tipChecks.createdAt, since)));
  return rows.length;
}

export async function recordTipCheck(input: {
  userId: string;
  symbol: string;
  side: string;
  agreement: number;
  summary: string;
  source: string;
}): Promise<void> {
  await getDb().insert(tipChecks).values({
    id: createId("chk"),
    userId: input.userId,
    symbol: input.symbol,
    side: input.side,
    agreement: input.agreement,
    summary: input.summary,
    source: input.source,
    createdAt: new Date().toISOString(),
  });
}

export async function tipCheckUsage(): Promise<{
  total: number;
  today: number;
  bySymbol: Array<{ symbol: string; count: number }>;
  recent: Array<{ id: string; userId: string; symbol: string; side: string; agreement: number; createdAt: string; source: string }>;
}> {
  const db = getDb();
  const since = zonedDayStart(new Date()).toISOString();
  const [all, todayRows, recent] = await Promise.all([
    db.select().from(tipChecks).orderBy(desc(tipChecks.createdAt)).limit(500),
    db.select({ id: tipChecks.id }).from(tipChecks).where(gte(tipChecks.createdAt, since)),
    db.select().from(tipChecks).orderBy(desc(tipChecks.createdAt)).limit(20),
  ]);
  const counts = new Map<string, number>();
  for (const row of all) counts.set(row.symbol, (counts.get(row.symbol) ?? 0) + 1);
  return {
    total: all.length,
    today: todayRows.length,
    bySymbol: [...counts.entries()].map(([symbol, count]) => ({ symbol, count })).sort((a, b) => b.count - a.count).slice(0, 12),
    recent: recent.map((row) => ({
      id: row.id,
      userId: row.userId,
      symbol: row.symbol,
      side: row.side,
      agreement: row.agreement,
      createdAt: row.createdAt,
      source: row.source,
    })),
  };
}

export async function notifyTracked(input: {
  tipId: string;
  kind: string;
  title: string;
  body: string;
  prefsMatch: (prefs: AlertPrefs) => boolean;
}): Promise<number> {
  const db = getDb();
  const tracked = await db.select().from(trackedTips).where(eq(trackedTips.tipId, input.tipId));
  if (tracked.length === 0) return 0;
  const userIds = tracked.map((row) => row.userId);
  const prefRows = await db.select().from(tipAlertPrefs).where(inArray(tipAlertPrefs.userId, userIds));
  const prefs = new Map(prefRows.map((row) => [row.userId, { targetHit: row.targetHit, stopLoss: row.stopLoss, expired: row.expired }]));
  const now = new Date().toISOString();
  let sent = 0;
  for (const row of tracked) {
    const choice = prefs.get(row.userId) ?? DEFAULT_ALERT_PREFS;
    if (!input.prefsMatch(choice)) continue;
    await db.insert(memberAlerts).values({
      id: createId("alert"),
      userId: row.userId,
      tipId: input.tipId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      createdAt: now,
    });
    sent += 1;
  }
  return sent;
}

async function requireTip(tipId: string): Promise<void> {
  const tip = await getTip(tipId);
  if (!tip || (tip.status !== "published" && tip.status !== "closed" && tip.status !== "expired")) {
    throw new AppError(404, "NOT_FOUND", "That idea is not available.");
  }
}
