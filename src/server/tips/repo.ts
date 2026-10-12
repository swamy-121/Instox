import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { adminDb } from "@/server/db/admin";
import { writeAudit } from "@/server/audit/log";
import { assertPublishChecklist, planTransition, type TransitionResult } from "@/server/tips/lifecycle";
import type {
  CloseReason,
  TipEvent,
  TipRecord,
  TipStatus,
  TransitionAction,
} from "@/types/domain";
import type { TipInput } from "@/lib/validation/tip";
import type { DocumentData, Firestore, Transaction } from "firebase-admin/firestore";

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

function asTip(id: string, data: DocumentData): TipRecord {
  return {
    id,
    symbol: String(data.symbol),
    instrumentId: String(data.instrumentId ?? data.symbol),
    segment: data.segment === "futures" || data.segment === "options" ? data.segment : "equity",
    category: data.category,
    side: data.side === "SELL" ? "SELL" : "BUY",
    entryMin: Number(data.entryMin),
    entryMax: data.entryMax == null ? null : Number(data.entryMax),
    stopLoss: Number(data.stopLoss),
    targets: Array.isArray(data.targets) ? data.targets : [],
    optionType: data.optionType === "CE" || data.optionType === "PE" ? data.optionType : null,
    strikePrice: data.strikePrice == null ? null : Number(data.strikePrice),
    expiry: data.expiry ? String(data.expiry) : null,
    underlying: data.underlying ? String(data.underlying) : null,
    lotSize: data.lotSize == null ? null : Number(data.lotSize),
    timeframe: String(data.timeframe ?? ""),
    thesis: String(data.thesis ?? ""),
    riskDisclosureVersion: String(data.riskDisclosureVersion ?? ""),
    accessTier: data.accessTier === "premium" ? "premium" : "free",
    status: data.status,
    closeReason: data.closeReason ?? null,
    publishedAt: data.publishedAt ? String(data.publishedAt) : null,
    expiresAt: data.expiresAt ? String(data.expiresAt) : null,
    createdBy: String(data.createdBy),
    updatedBy: String(data.updatedBy),
    createdAt: String(data.createdAt),
    updatedAt: String(data.updatedAt),
    schemaVersion: Number(data.schemaVersion ?? SCHEMA_VERSION),
    version: Number(data.version ?? 1),
    featured: data.featured === true,
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

export async function createDraft(input: {
  tip: TipInput;
  actorUid: string;
  requestId: string;
}): Promise<TipRecord> {
  const db = adminDb();
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
  const event = eventFrom(
    id,
    "draft_created",
    input.actorUid,
    "Draft created",
    input.requestId,
    null,
    "draft",
    null,
    1,
    null,
    now,
  );

  await db.runTransaction(async (tx) => {
    tx.set(db.collection("tips").doc(id), {
      ...tip,
      publishedSort: null,
      updatedSort: sortKey(now, id),
    });
    tx.set(db.collection("tipEvents").doc(event.id), event);
    writeAudit(tx, db, {
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

async function loadTip(tx: Transaction, db: Firestore, tipId: string): Promise<TipRecord> {
  const snap = await tx.get(db.collection("tips").doc(tipId));
  if (!snap.exists) {
    throw new AppError(404, "NOT_FOUND", "That tip does not exist.");
  }
  return asTip(snap.id, snap.data() ?? {});
}

export async function updateTipContent(input: {
  tipId: string;
  tip: TipInput;
  expectedVersion: number;
  reason: string;
  actorUid: string;
  requestId: string;
}): Promise<TipRecord> {
  const db = adminDb();
  const now = new Date().toISOString();
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new AppError(400, "VALIDATION_ERROR", "A reason is required.", {
      reason: "Enter a short reason (at least 3 characters).",
    });
  }

  return db.runTransaction(async (tx) => {
    const current = await loadTip(tx, db, input.tipId);
    if (current.version !== input.expectedVersion) {
      throw new AppError(409, "STATE_CONFLICT", "This tip was updated by someone else. Reload it and try again.");
    }
    if (current.status !== "draft" && current.status !== "in_review" && current.status !== "published") {
      throw new AppError(409, "STATE_CONFLICT", "This tip can no longer be edited.");
    }
    if (current.status === "published" && reason.length < 3) {
      throw new AppError(400, "VALIDATION_ERROR", "A correction reason is required.", { reason: "Required." });
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
    tx.set(db.collection("tips").doc(current.id), {
      ...next,
      publishedSort: next.publishedAt ? sortKey(next.publishedAt, next.id) : null,
      updatedSort: sortKey(now, next.id),
    });
    tx.set(db.collection("tipEvents").doc(event.id), event);
    writeAudit(tx, db, {
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
  const db = adminDb();
  const now = new Date().toISOString();

  if (input.idempotencyKey) {
    const existing = await db.collection("idempotencyKeys").doc(input.idempotencyKey).get();
    if (existing.exists) {
      const stored = existing.data();
      if (stored?.tipId !== input.tipId || stored?.action !== input.action) {
        throw new AppError(409, "STATE_CONFLICT", "That idempotency key was already used for a different action.");
      }
      const tipSnap = await db.collection("tips").doc(input.tipId).get();
      if (!tipSnap.exists) throw new AppError(404, "NOT_FOUND", "That tip does not exist.");
      return asTip(tipSnap.id, tipSnap.data() ?? {});
    }
  }

  return db.runTransaction(async (tx) => {
    if (input.idempotencyKey) {
      const keySnap = await tx.get(db.collection("idempotencyKeys").doc(input.idempotencyKey));
      if (keySnap.exists) {
        const tipSnap = await tx.get(db.collection("tips").doc(input.tipId));
        if (!tipSnap.exists) throw new AppError(404, "NOT_FOUND", "That tip does not exist.");
        return asTip(tipSnap.id, tipSnap.data() ?? {});
      }
    }

    const current = await loadTip(tx, db, input.tipId);
    if (input.action === "publish") {
      assertPublishChecklist(input.checklist ?? []);
    }
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
    tx.set(db.collection("tips").doc(current.id), {
      ...next,
      publishedSort: next.publishedAt ? sortKey(next.publishedAt, next.id) : null,
      updatedSort: sortKey(now, next.id),
    });
    tx.set(db.collection("tipEvents").doc(event.id), event);
    writeAudit(tx, db, {
      actorUid: input.actorUid,
      action: `tip.${planned.eventType}`,
      targetType: "tip",
      targetId: current.id,
      reason: planned.reason,
      requestId: input.requestId,
      occurredAt: now,
    });
    if (input.idempotencyKey) {
      tx.set(db.collection("idempotencyKeys").doc(input.idempotencyKey), {
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
  if (filters.q) {
    const needle = filters.q.toUpperCase();
    if (!tip.symbol.includes(needle)) return false;
  }
  return true;
}

export async function listPublishedTips(filters: MemberFilters): Promise<{ tips: TipRecord[]; nextCursor: string | null }> {
  const db = adminDb();
  const cursor = decodeCursor(filters.cursor);
  const matches: TipRecord[] = [];
  let lastSort = cursor;
  let scanned = 0;

  while (matches.length <= filters.limit && scanned < 200) {
    let query = db.collection("tips").where("status", "==", "published").orderBy("publishedSort", "desc");
    if (lastSort) query = query.startAfter(lastSort);
    const snap = await query.limit(40).get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      scanned += 1;
      const tip = asTip(doc.id, doc.data());
      lastSort = String(doc.data().publishedSort ?? "");
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
    if (snap.size < 40) break;
  }

  return {
    tips: matches.slice(0, filters.limit),
    nextCursor: scanned >= 200 && lastSort ? encodeCursor(lastSort) : null,
  };
}

export async function listAdminTips(filters: {
  status?: string;
  category?: string;
  q?: string;
  author?: string;
  cursor: string | null;
  limit: number;
}): Promise<{ tips: TipRecord[]; nextCursor: string | null }> {
  const db = adminDb();
  const cursor = decodeCursor(filters.cursor);
  const matches: TipRecord[] = [];
  let lastSort = cursor;
  let scanned = 0;

  while (matches.length <= filters.limit && scanned < 200) {
    let query = db.collection("tips").orderBy("updatedSort", "desc");
    if (filters.status) query = db.collection("tips").where("status", "==", filters.status).orderBy("updatedSort", "desc");
    if (lastSort) query = query.startAfter(lastSort);
    const snap = await query.limit(40).get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      scanned += 1;
      const tip = asTip(doc.id, doc.data());
      lastSort = String(doc.data().updatedSort ?? "");
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
    if (snap.size < 40) break;
  }
  return {
    tips: matches.slice(0, filters.limit),
    nextCursor: scanned >= 200 && lastSort ? encodeCursor(lastSort) : null,
  };
}

export async function getTip(tipId: string): Promise<TipRecord | null> {
  const snap = await adminDb().collection("tips").doc(tipId).get();
  if (!snap.exists) return null;
  return asTip(snap.id, snap.data() ?? {});
}

export async function listTipEvents(tipId: string): Promise<TipEvent[]> {
  const snap = await adminDb()
    .collection("tipEvents")
    .where("tipId", "==", tipId)
    .orderBy("occurredAt", "asc")
    .get();
  return snap.docs.map((doc) => doc.data() as TipEvent);
}

export async function countTipsByStatus(): Promise<Record<string, number>> {
  const statuses: TipStatus[] = ["draft", "in_review", "published", "closed", "cancelled", "expired"];
  const entries = await Promise.all(
    statuses.map(async (status) => {
      const snap = await adminDb().collection("tips").where("status", "==", status).count().get();
      return [status, snap.data().count] as const;
    }),
  );
  return Object.fromEntries(entries);
}
