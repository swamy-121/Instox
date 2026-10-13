import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import type { TipInput } from "@/lib/validation/tip";
import { insertAudit } from "@/server/audit/log";
import { getDb } from "@/server/db/client";
import { idempotencyKeys, tipEvents, tips } from "@/server/db/schema";
import { assertPublishChecklist, planTransition, type TransitionResult } from "@/server/tips/lifecycle";
import type { CloseReason, TipEvent, TipRecord, TipStatus, TransitionAction } from "@/types/domain";

const SCHEMA_VERSION = 1;

export function sortKey(iso: string, id: string): string {
  return `${iso}_${id}`;
}

export function encodeCursor(sort: string): string {
  return Buffer.from(JSON.stringify({ sort }), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | null): string | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { sort?: unknown };
    if (typeof parsed.sort === "string" && parsed.sort.length > 0) return parsed.sort;
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "That page cursor is not valid.", { cursor: "Invalid cursor." });
  }
  throw new AppError(400, "VALIDATION_ERROR", "That page cursor is not valid.", { cursor: "Invalid cursor." });
}

function asTip(row: typeof tips.$inferSelect): TipRecord {
  return {
    id: row.id,
    symbol: row.symbol,
    instrumentId: row.instrumentId,
    segment: row.segment === "futures" || row.segment === "options" ? row.segment : "equity",
    category: row.category as TipRecord["category"],
    side: row.side === "SELL" ? "SELL" : "BUY",
    entryMin: row.entryMin,
    entryMax: row.entryMax,
    stopLoss: row.stopLoss,
    targets: (row.targets ?? []) as TipRecord["targets"],
    optionType: row.optionType === "CE" || row.optionType === "PE" ? row.optionType : null,
    strikePrice: row.strikePrice,
    expiry: row.expiry,
    underlying: row.underlying,
    lotSize: row.lotSize,
    timeframe: row.timeframe,
    thesis: row.thesis,
    riskDisclosureVersion: row.riskDisclosureVersion,
    accessTier: row.accessTier === "premium" ? "premium" : "free",
    status: row.status as TipStatus,
    closeReason: (row.closeReason as CloseReason | null) ?? null,
    publishedAt: row.publishedAt,
    expiresAt: row.expiresAt,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    schemaVersion: row.schemaVersion,
    version: row.version,
    featured: row.featured,
  };
}

function tipValues(tip: TipRecord, publishedSort: string | null, updatedSort: string) {
  return {
    id: tip.id,
    symbol: tip.symbol,
    instrumentId: tip.instrumentId,
    segment: tip.segment,
    category: tip.category,
    side: tip.side,
    entryMin: tip.entryMin,
    entryMax: tip.entryMax,
    stopLoss: tip.stopLoss,
    targets: tip.targets,
    optionType: tip.optionType,
    strikePrice: tip.strikePrice,
    expiry: tip.expiry,
    underlying: tip.underlying,
    lotSize: tip.lotSize,
    timeframe: tip.timeframe,
    thesis: tip.thesis,
    riskDisclosureVersion: tip.riskDisclosureVersion,
    accessTier: tip.accessTier,
    status: tip.status,
    closeReason: tip.closeReason,
    publishedAt: tip.publishedAt,
    expiresAt: tip.expiresAt,
    createdBy: tip.createdBy,
    updatedBy: tip.updatedBy,
    createdAt: tip.createdAt,
    updatedAt: tip.updatedAt,
    schemaVersion: tip.schemaVersion,
    version: tip.version,
    featured: tip.featured === true,
    publishedSort,
    updatedSort,
  };
}

function eventFrom(
  tipId: string,
  eventType: TipEvent["eventType"],
  actorUid: string,
  reason: string,
  requestId: string,
  oldStatus: TipStatus | null,
  newStatus: TipStatus | null,
  oldVersion: number | null,
  newVersion: number | null,
  previous: Partial<TipRecord> | null,
  occurredAt: string,
): TipEvent {
  return {
    id: createId("evt"),
    tipId,
    eventType,
    oldStatus,
    newStatus,
    oldVersion,
    newVersion,
    reason,
    actorUid,
    occurredAt,
    requestId,
    previous,
  };
}

function snapshotTradingFields(tip: TipRecord): Partial<TipRecord> {
  return {
    entryMin: tip.entryMin,
    entryMax: tip.entryMax,
    stopLoss: tip.stopLoss,
    targets: tip.targets,
    thesis: tip.thesis,
    accessTier: tip.accessTier,
    timeframe: tip.timeframe,
    expiry: tip.expiry,
    strikePrice: tip.strikePrice,
    optionType: tip.optionType,
  };
}

async function loadTip(db: Pick<ReturnType<typeof getDb>, "select">, tipId: string): Promise<TipRecord> {
  const rows = await db.select().from(tips).where(eq(tips.id, tipId)).limit(1);
  if (!rows[0]) throw new AppError(404, "NOT_FOUND", "That tip does not exist.");
  return asTip(rows[0]);
}

export async function createDraft(input: { tip: TipInput; actorUid: string; requestId: string }): Promise<TipRecord> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = createId("tip");
  const tip: TipRecord = {
    ...input.tip,
    id,
    status: "draft",
    closeReason: null,
    publishedAt: null,
    createdBy: input.actorUid,
    updatedBy: input.actorUid,
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
    version: 1,
  };
  const event = eventFrom(id, "draft_created", input.actorUid, "Draft created", input.requestId, null, "draft", null, 1, null, now);
  await db.transaction(async (tx) => {
    await tx.insert(tips).values(tipValues(tip, null, sortKey(now, id)));
    await tx.insert(tipEvents).values({ ...event, previous: event.previous });
    await insertAudit(tx, {
      actorUid: input.actorUid,
      action: "tip.draft_created",
      targetType: "tip",
      targetId: id,
      reason: "Draft created",
      requestId: input.requestId,
      occurredAt: now,
    });
  });
  return tip;
}

export async function updateTipContent(input: {
  tipId: string;
  tip: TipInput;
  expectedVersion: number;
  reason: string;
  actorUid: string;
  requestId: string;
}): Promise<TipRecord> {
  const db = getDb();
  const now = new Date().toISOString();
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new AppError(400, "VALIDATION_ERROR", "A reason is required.", { reason: "Enter a short reason (at least 3 characters)." });
  }
  return db.transaction(async (tx) => {
    const current = await loadTip(tx, input.tipId);
    if (current.version !== input.expectedVersion) {
      throw new AppError(409, "STATE_CONFLICT", "This tip was updated by someone else. Reload it and try again.");
    }
    if (current.status !== "draft" && current.status !== "in_review" && current.status !== "published") {
      throw new AppError(409, "STATE_CONFLICT", "This tip can no longer be edited.");
    }
    const nextVersion = current.version + 1;
    const next: TipRecord = {
      ...current,
      ...input.tip,
      id: current.id,
      status: current.status,
      closeReason: current.closeReason,
      publishedAt: current.publishedAt,
      createdBy: current.createdBy,
      createdAt: current.createdAt,
      updatedBy: input.actorUid,
      updatedAt: now,
      version: nextVersion,
    };
    const event = eventFrom(
      current.id,
      current.status === "published" ? "content_corrected" : "content_updated",
      input.actorUid,
      reason,
      input.requestId,
      current.status,
      current.status,
      current.version,
      nextVersion,
      snapshotTradingFields(current),
      now,
    );
    await tx.insert(tips).values(tipValues(next, next.publishedAt ? sortKey(next.publishedAt, next.id) : null, sortKey(now, next.id))).onConflictDoUpdate({
      target: tips.id,
      set: tipValues(next, next.publishedAt ? sortKey(next.publishedAt, next.id) : null, sortKey(now, next.id)),
    });
    await tx.insert(tipEvents).values(event);
    await insertAudit(tx, {
      actorUid: input.actorUid,
      action: current.status === "published" ? "tip.content_corrected" : "tip.content_updated",
      targetType: "tip",
      targetId: current.id,
      reason,
      requestId: input.requestId,
      occurredAt: now,
    });
    return next;
  });
}

function applyTransition(current: TipRecord, planned: TransitionResult, actorUid: string, now: string): TipRecord {
  return {
    ...current,
    status: planned.nextStatus,
    closeReason: planned.nextStatus === "closed" ? planned.closeReason : current.closeReason,
    publishedAt: planned.nextStatus === "published" ? current.publishedAt ?? now : current.publishedAt,
    updatedBy: actorUid,
    updatedAt: now,
    version: planned.nextVersion,
  };
}

async function commitTransition(input: {
  tipId: string;
  action: TransitionAction;
  reason?: string;
  closeReason?: CloseReason | null;
  expectedVersion: number;
  actorUid: string;
  requestId: string;
  checklist?: string[];
  idempotencyKey?: string;
}): Promise<TipRecord> {
  const db = getDb();
  const now = new Date().toISOString();
  if (input.idempotencyKey) {
    const existing = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.id, input.idempotencyKey)).limit(1);
    if (existing[0]) {
      if (existing[0].tipId !== input.tipId || existing[0].action !== input.action) {
        throw new AppError(409, "STATE_CONFLICT", "That idempotency key was already used for a different action.");
      }
      return loadTip(db, input.tipId);
    }
  }
  return db.transaction(async (tx) => {
    if (input.idempotencyKey) {
      const keySnap = await tx.select().from(idempotencyKeys).where(eq(idempotencyKeys.id, input.idempotencyKey)).limit(1);
      if (keySnap[0]) return loadTip(tx, input.tipId);
    }
    const current = await loadTip(tx, input.tipId);
    if (input.action === "publish") assertPublishChecklist(input.checklist ?? []);
    const planned = planTransition({
      status: current.status,
      action: input.action,
      reason: input.reason,
      closeReason: input.closeReason,
      version: current.version,
      expectedVersion: input.expectedVersion,
    });
    const next = applyTransition(current, planned, input.actorUid, now);
    const event = eventFrom(
      current.id,
      planned.eventType,
      input.actorUid,
      planned.reason,
      input.requestId,
      current.status,
      next.status,
      current.version,
      next.version,
      input.action === "publish" ? null : snapshotTradingFields(current),
      now,
    );
    const publishedSort = next.publishedAt ? sortKey(next.publishedAt, next.id) : null;
    await tx.insert(tips).values(tipValues(next, publishedSort, sortKey(now, next.id))).onConflictDoUpdate({
      target: tips.id,
      set: tipValues(next, publishedSort, sortKey(now, next.id)),
    });
    await tx.insert(tipEvents).values(event);
    await insertAudit(tx, {
      actorUid: input.actorUid,
      action: `tip.${planned.eventType}`,
      targetType: "tip",
      targetId: current.id,
      reason: planned.reason,
      requestId: input.requestId,
      occurredAt: now,
    });
    if (input.idempotencyKey) {
      await tx.insert(idempotencyKeys).values({
        id: input.idempotencyKey,
        tipId: current.id,
        action: input.action,
        actorUid: input.actorUid,
        createdAt: now,
      });
    }
    return next;
  });
}

export function publishTip(input: {
  tipId: string;
  expectedVersion: number;
  reason: string;
  checklist: string[];
  actorUid: string;
  requestId: string;
  idempotencyKey: string;
}): Promise<TipRecord> {
  return commitTransition({ ...input, action: "publish" });
}

export function transitionTip(input: {
  tipId: string;
  action: Exclude<TransitionAction, "publish">;
  reason: string;
  closeReason?: CloseReason | null;
  expectedVersion: number;
  actorUid: string;
  requestId: string;
}): Promise<TipRecord> {
  return commitTransition(input);
}

type MemberFilters = {
  category?: string;
  accessTier?: string;
  q?: string;
  featured?: boolean;
  cursor: string | null;
  limit: number;
};

function matchesMember(tip: TipRecord, filters: MemberFilters): boolean {
  if (filters.category && tip.category !== filters.category) return false;
  if (filters.accessTier && tip.accessTier !== filters.accessTier) return false;
  if (filters.featured && tip.featured !== true) return false;
  if (filters.q && !tip.symbol.includes(filters.q.toUpperCase())) return false;
  return true;
}

export async function listPublishedTips(filters: MemberFilters): Promise<{ tips: TipRecord[]; nextCursor: string | null }> {
  const db = getDb();
  const cursor = decodeCursor(filters.cursor);
  const matches: TipRecord[] = [];
  let lastSort = cursor;
  let scanned = 0;
  while (matches.length <= filters.limit && scanned < 200) {
    const rows = await db
      .select()
      .from(tips)
      .where(and(eq(tips.status, "published"), lastSort ? lt(tips.publishedSort, lastSort) : undefined))
      .orderBy(desc(tips.publishedSort))
      .limit(40);
    if (rows.length === 0) break;
    for (const row of rows) {
      scanned += 1;
      const tip = asTip(row);
      lastSort = row.publishedSort ?? "";
      if (!matchesMember(tip, filters)) continue;
      matches.push(tip);
      if (matches.length > filters.limit) {
        const last = matches[filters.limit - 1];
        return {
          tips: matches.slice(0, filters.limit),
          nextCursor: last ? encodeCursor(sortKey(last.publishedAt ?? last.updatedAt, last.id)) : null,
        };
      }
    }
    if (rows.length < 40) break;
  }
  return { tips: matches.slice(0, filters.limit), nextCursor: scanned >= 200 && lastSort ? encodeCursor(lastSort) : null };
}

export async function listAdminTips(filters: {
  status?: string;
  category?: string;
  q?: string;
  author?: string;
  cursor: string | null;
  limit: number;
}): Promise<{ tips: TipRecord[]; nextCursor: string | null }> {
  const db = getDb();
  const cursor = decodeCursor(filters.cursor);
  const matches: TipRecord[] = [];
  let lastSort = cursor;
  let scanned = 0;
  while (matches.length <= filters.limit && scanned < 200) {
    const rows = await db
      .select()
      .from(tips)
      .where(and(filters.status ? eq(tips.status, filters.status) : undefined, lastSort ? lt(tips.updatedSort, lastSort) : undefined))
      .orderBy(desc(tips.updatedSort))
      .limit(40);
    if (rows.length === 0) break;
    for (const row of rows) {
      scanned += 1;
      const tip = asTip(row);
      lastSort = row.updatedSort;
      if (filters.category && tip.category !== filters.category) continue;
      if (filters.author && tip.createdBy !== filters.author) continue;
      if (filters.q && !tip.symbol.includes(filters.q.toUpperCase())) continue;
      matches.push(tip);
      if (matches.length > filters.limit) {
        const last = matches[filters.limit - 1];
        return {
          tips: matches.slice(0, filters.limit),
          nextCursor: last ? encodeCursor(sortKey(last.updatedAt, last.id)) : null,
        };
      }
    }
    if (rows.length < 40) break;
  }
  return { tips: matches.slice(0, filters.limit), nextCursor: scanned >= 200 && lastSort ? encodeCursor(lastSort) : null };
}

export async function getTip(tipId: string): Promise<TipRecord | null> {
  const rows = await getDb().select().from(tips).where(eq(tips.id, tipId)).limit(1);
  return rows[0] ? asTip(rows[0]) : null;
}

export async function getTipsByIds(ids: string[]): Promise<TipRecord[]> {
  if (ids.length === 0) return [];
  const rows = await getDb().select().from(tips).where(inArray(tips.id, ids));
  return rows.map(asTip);
}

export async function listPublishedForRecommend(limit = 40): Promise<TipRecord[]> {
  const rows = await getDb()
    .select()
    .from(tips)
    .where(eq(tips.status, "published"))
    .orderBy(desc(tips.publishedSort))
    .limit(limit);
  return rows.map(asTip);
}

export async function deleteDraftTip(tipId: string): Promise<void> {
  const tip = await getTip(tipId);
  if (!tip) throw new AppError(404, "NOT_FOUND", "That tip does not exist.");
  if (tip.status !== "draft") throw new AppError(422, "BUSINESS_RULE_FAILED", "Only a draft can be deleted.");
  await getDb().delete(tips).where(eq(tips.id, tipId));
}

export async function listTipEvents(tipId: string): Promise<TipEvent[]> {
  const rows = await getDb().select().from(tipEvents).where(eq(tipEvents.tipId, tipId)).orderBy(tipEvents.occurredAt);
  return rows.map((row) => ({
    id: row.id,
    tipId: row.tipId,
    eventType: row.eventType as TipEvent["eventType"],
    oldStatus: row.oldStatus as TipStatus | null,
    newStatus: row.newStatus as TipStatus | null,
    oldVersion: row.oldVersion,
    newVersion: row.newVersion,
    reason: row.reason,
    actorUid: row.actorUid,
    occurredAt: row.occurredAt,
    requestId: row.requestId,
    previous: row.previous as TipEvent["previous"],
  }));
}

export async function countTipsByStatus(): Promise<Record<string, number>> {
  const rows = await getDb()
    .select({ status: tips.status, count: sql<number>`count(*)::int` })
    .from(tips)
    .groupBy(tips.status);
  const counts: Record<string, number> = {};
  for (const status of ["draft", "in_review", "published", "closed", "cancelled", "expired"]) counts[status] = 0;
  for (const row of rows) counts[row.status] = Number(row.count);
  return counts;
}

export async function listTipsByStatuses(statuses: TipStatus[], limit = 200): Promise<TipRecord[]> {
  const rows = await getDb().select().from(tips).where(inArray(tips.status, statuses)).limit(limit);
  return rows.map(asTip);
}
