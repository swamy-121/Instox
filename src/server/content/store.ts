import { and, asc, eq } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { candleSeries, contentDocuments } from "@/server/db/schema";
import {
  isContentName,
  parseContent,
  publicRecord,
  tryParseContent,
  type ContentName,
  type ContentRecord,
} from "@/server/content/registry";

function sortValue(record: ContentRecord): number {
  return "sort" in record && typeof record.sort === "number" ? record.sort : 0;
}

function meta(record: Record<string, unknown>) {
  return {
    status: typeof record.status === "string" ? record.status : null,
    sort: typeof record.sort === "number" ? record.sort : 0,
    active: typeof record.active === "boolean" ? record.active : null,
  };
}

export async function listContent<T extends ContentName>(name: T, scope: "public" | "admin"): Promise<ContentRecord<T>[]> {
  const rows = await getDb()
    .select()
    .from(contentDocuments)
    .where(eq(contentDocuments.collection, name))
    .orderBy(asc(contentDocuments.sort), asc(contentDocuments.id))
    .limit(100);
  const records: ContentRecord<T>[] = [];
  for (const row of rows) {
    const parsed = tryParseContent(name, { id: row.id, ...row.body });
    if (!parsed) continue;
    if (scope === "public") {
      const visible = publicRecord(name, parsed);
      if (!visible) continue;
      records.push(visible);
    } else {
      records.push(parsed);
    }
  }
  return records.sort((a, b) => sortValue(a) - sortValue(b) || a.id.localeCompare(b.id));
}

export async function saveContent<T extends ContentName>(name: T, input: unknown): Promise<ContentRecord<T>> {
  let parsed: ContentRecord<T>;
  try {
    parsed = parseContent(name, input);
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "That record does not match the collection.", { form: "Check the required fields." });
  }
  const body = parsed as Record<string, unknown>;
  const flags = meta(body);
  await getDb()
    .insert(contentDocuments)
    .values({ collection: name, id: parsed.id, body, ...flags })
    .onConflictDoUpdate({
      target: [contentDocuments.collection, contentDocuments.id],
      set: { body, ...flags },
    });
  await syncCandleSeries(name, parsed as { symbol?: string; candles?: unknown[] });
  return parsed;
}

async function syncCandleSeries(name: ContentName, record: { symbol?: string; candles?: unknown[] }): Promise<void> {
  if (name !== "candleSeries" || !record.symbol || !Array.isArray(record.candles)) return;
  await getDb()
    .insert(candleSeries)
    .values({ symbol: record.symbol, candles: record.candles })
    .onConflictDoUpdate({ target: candleSeries.symbol, set: { candles: record.candles } });
}

export async function mergeContent(name: ContentName, id: string, patch: Record<string, unknown>): Promise<void> {
  const rows = await getDb()
    .select()
    .from(contentDocuments)
    .where(and(eq(contentDocuments.collection, name), eq(contentDocuments.id, id)))
    .limit(1);
  const current = rows[0]?.body ?? { id };
  const body = { ...current, ...patch, id };
  const flags = meta(body);
  await getDb()
    .insert(contentDocuments)
    .values({ collection: name, id, body, ...flags })
    .onConflictDoUpdate({
      target: [contentDocuments.collection, contentDocuments.id],
      set: { body, ...flags },
    });
}

export async function deleteContent(name: ContentName, id: string): Promise<void> {
  const rows = await getDb()
    .select()
    .from(contentDocuments)
    .where(and(eq(contentDocuments.collection, name), eq(contentDocuments.id, id)))
    .limit(1);
  if (!rows[0]) throw new AppError(404, "NOT_FOUND", "That record was not found.");
  await getDb().delete(contentDocuments).where(and(eq(contentDocuments.collection, name), eq(contentDocuments.id, id)));
  if (name === "candleSeries") {
    const symbol = typeof rows[0].body.symbol === "string" ? rows[0].body.symbol : id;
    await getDb().delete(candleSeries).where(eq(candleSeries.symbol, symbol));
  }
}

export function assertContentName(value: string): ContentName {
  if (!isContentName(value)) throw new AppError(404, "NOT_FOUND", "Unknown content collection.");
  return value;
}
