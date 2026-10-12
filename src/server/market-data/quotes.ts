import { createHash } from "node:crypto";
import { isLiveIndex, LIVE_INDEX_SYMBOLS } from "@/lib/live-indices";

export { isLiveIndex, LIVE_INDEX_SYMBOLS };

/** Alice Blue contract tokens for index subscriptions. Equity tokens come from the search API. */
export const ALICE_INDEX_CONTRACTS: Record<string, { exchange: string; token: string }> = {
  NIFTY: { exchange: "NSE", token: "26000" },
  BANKNIFTY: { exchange: "NSE", token: "26009" },
  SENSEX: { exchange: "BSE", token: "1" },
};

const YAHOO_SYMBOLS: Record<string, string> = {
  NIFTY: "^NSEI",
  SENSEX: "^BSESN",
  BANKNIFTY: "^NSEBANK",
  NIFTYFIN: "NIFTY_FIN_SERVICE.NS",
};

export type Freshness = "live" | "stale" | "offline" | "stored" | "delayed";
export type FeedId = "mock" | "aliceblue" | "dev";

export type QuoteSnapshot = {
  symbol: string;
  last: number | null;
  changePct: number | null;
  sourceTimestamp: string | null;
  updatedAt: string;
  providerId: FeedId;
};

export function activeFeedId(env: NodeJS.ProcessEnv = process.env): FeedId {
  if (env.MARKET_DATA_PROVIDER === "aliceblue") return "aliceblue";
  if (env.MARKET_DATA_PROVIDER === "dev" && env.NODE_ENV !== "production") return "dev";
  return "mock";
}

export function feedMaxAgeMs(feed: FeedId): number {
  if (feed === "aliceblue") return 20_000;
  if (feed === "dev") return 5 * 60_000;
  return Number.POSITIVE_INFINITY;
}

export function aliceUserData(userId: string, apiKey: string, encKey: string): string {
  return createHash("sha256").update(`${userId.toUpperCase()}${apiKey}${encKey}`).digest("hex");
}

export function aliceSocketToken(sessionId: string): string {
  const once = createHash("sha256").update(sessionId).digest("hex");
  return createHash("sha256").update(once).digest("hex");
}

export function subscribeKey(contracts: Array<{ exchange: string; token: string }>): string {
  return contracts.map((item) => `${item.exchange}|${item.token}`).join("#");
}

export function yahooSymbol(symbol: string): string {
  return YAHOO_SYMBOLS[symbol] ?? `${symbol}.NS`;
}

export function parseAliceTick(message: string): { exchange: string; token: string; last: number; changePct: number | null; at: string } | null {
  let body: unknown;
  try {
    body = JSON.parse(message);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  if (row.t !== "tf" && row.t !== "tk") return null;
  const last = Number(row.lp);
  if (!Number.isFinite(last)) return null;
  const change = Number(row.pc);
  const seconds = Number(row.ft);
  const at = Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : new Date().toISOString();
  return {
    exchange: String(row.e ?? ""),
    token: String(row.tk ?? ""),
    last,
    changePct: Number.isFinite(change) ? change : null,
    at,
  };
}

export function parseScripSearch(body: unknown, symbol: string): { exchange: string; token: string } | null {
  const rows = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { result?: unknown }).result)
      ? (body as { result: unknown[] }).result
      : [];
  const wanted = symbol.toUpperCase();
  const match = rows.find((row) => {
    if (!row || typeof row !== "object") return false;
    const item = row as Record<string, unknown>;
    const name = String(item.symbol ?? item.formattedInsName ?? "").toUpperCase();
    const expiry = String(item.expiry ?? "");
    return name.includes(wanted) && (expiry === "" || expiry === "0" || expiry.toLowerCase() === "null");
  }) as Record<string, unknown> | undefined;
  const token = match ? String(match.token ?? "") : "";
  const exchange = match ? String(match.exch ?? match.exchange ?? "") : "";
  if (!token || !exchange) return null;
  return { exchange, token };
}

export function parseYahooChart(body: unknown): { last: number; changePct: number; at: string; closes: number[] } | null {
  if (!body || typeof body !== "object") return null;
  const chart = (body as { chart?: { result?: unknown[] } }).chart?.result?.[0];
  if (!chart || typeof chart !== "object") return null;
  const meta = (chart as { meta?: Record<string, unknown> }).meta ?? {};
  const last = Number(meta.regularMarketPrice);
  const previous = Number(meta.chartPreviousClose ?? meta.previousClose);
  if (!Number.isFinite(last)) return null;
  const changePct = Number.isFinite(previous) && previous !== 0 ? ((last - previous) / previous) * 100 : 0;
  const seconds = Number(meta.regularMarketTime);
  const closes = Array.isArray((chart as { indicators?: { quote?: Array<{ close?: unknown[] }> } }).indicators?.quote?.[0]?.close)
    ? ((chart as { indicators: { quote: Array<{ close: unknown[] }> } }).indicators.quote[0]?.close ?? [])
        .flatMap((value) => {
          if (value === null || value === undefined || value === "") return [];
          const next = Number(value);
          return Number.isFinite(next) ? [next] : [];
        })
    : [];
  return {
    last,
    changePct: Math.round(changePct * 100) / 100,
    at: Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : new Date().toISOString(),
    closes,
  };
}

export function freshnessOf(snapshot: QuoteSnapshot | null, feed: FeedId, nowMs: number): Freshness {
  if (feed === "mock") return "stored";
  if (!snapshot || snapshot.last === null) return "offline";
  const age = nowMs - Date.parse(snapshot.updatedAt);
  if (!Number.isFinite(age) || age > feedMaxAgeMs(feed)) return "stale";
  return "live";
}

export function presentIndexQuote<T extends { symbol: string; last: number; changePct?: number }>(
  row: T,
  snapshot: QuoteSnapshot | null,
  feed: FeedId,
  connected: boolean,
  nowMs: number,
): T & { freshnessStatus: Freshness } {
  if (feed === "mock" || !isLiveIndex(row.symbol)) return { ...row, freshnessStatus: "stored" };
  if (feed === "aliceblue" && !connected) {
    if (snapshot?.last != null) {
      return {
        ...row,
        last: snapshot.last,
        ...(snapshot.changePct == null ? {} : { changePct: snapshot.changePct }),
        freshnessStatus: "delayed",
      };
    }
    return { ...row, freshnessStatus: "delayed" };
  }
  return overlayQuote(row, snapshot, feed, nowMs);
}

export function overlayQuote<T extends { symbol: string; last: number; changePct?: number }>(
  row: T,
  snapshot: QuoteSnapshot | null,
  feed: FeedId,
  nowMs: number,
): T & { freshnessStatus: Freshness } {
  const freshnessStatus = freshnessOf(snapshot, feed, nowMs);
  if ((freshnessStatus === "live" || freshnessStatus === "stale") && snapshot?.last != null) {
    return {
      ...row,
      last: snapshot.last,
      changePct: snapshot.changePct ?? row.changePct,
      freshnessStatus,
    };
  }
  if (freshnessStatus === "offline") return { ...row, freshnessStatus };
  return { ...row, freshnessStatus: "stored" };
}

export async function decodeFrame(data: unknown): Promise<string> {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data);
  if (typeof Blob !== "undefined" && data instanceof Blob) return data.text();
  return "";
}

export function applyLiveClose<T extends { close: number; closeTime?: string }>(candles: T[], last: number | null, at: string | null): T[] {
  if (last === null || candles.length === 0) return candles;
  const next = candles.slice();
  const tail = next[next.length - 1];
  if (!tail) return candles;
  next[next.length - 1] = { ...tail, close: last, closeTime: at ?? tail.closeTime };
  return next;
}
