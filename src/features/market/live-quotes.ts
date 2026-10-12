export type StreamQuote = {
  symbol: string;
  last: number | null;
  changePct: number | null;
  updatedAt?: string;
};

export type ShownFreshness = "live" | "stale" | "offline" | "stored";

const MAX_AGE_MS: Record<"aliceblue" | "dev", number> = {
  aliceblue: 20_000,
  dev: 5 * 60_000,
};

export function mergeDisplayed<T extends { last: number; changePct?: number; freshnessStatus?: string }>(
  row: T,
  streamed: StreamQuote | undefined,
  feed: string | undefined,
  streamDown: boolean,
  now = Date.now(),
): T & { freshnessStatus: ShownFreshness } {
  if (feed !== "aliceblue" && feed !== "dev") {
    return { ...row, freshnessStatus: "stored" };
  }
  const last = streamed?.last ?? row.last;
  const changePct = streamed?.changePct ?? row.changePct;
  const next = { ...row, last, ...(changePct === undefined ? {} : { changePct }) };
  if (streamed?.last == null && row.freshnessStatus === "offline") {
    return { ...next, last: row.last, freshnessStatus: "offline" };
  }
  if (streamDown) {
    return { ...next, freshnessStatus: last == null ? "offline" : "stale" };
  }
  if (streamed?.updatedAt) {
    const age = now - Date.parse(streamed.updatedAt);
    if (!Number.isFinite(age) || age > MAX_AGE_MS[feed]) {
      return { ...next, freshnessStatus: "stale" };
    }
    return { ...next, freshnessStatus: "live" };
  }
  if (row.freshnessStatus === "live" || row.freshnessStatus === "stale" || row.freshnessStatus === "offline") {
    return { ...next, freshnessStatus: row.freshnessStatus };
  }
  return { ...next, freshnessStatus: "stored" };
}

export function shownQuote(
  base: { last: number | null; changePct: number | null; freshnessStatus?: string } | undefined,
  streamed: StreamQuote | undefined,
  feed: string | undefined,
  streamDown: boolean,
  now = Date.now(),
): { last: number; changePct: number; freshnessStatus: ShownFreshness } | null {
  const baseLast = base?.last ?? null;
  const baseChange = base?.changePct ?? null;
  if (baseLast == null && streamed?.last == null) {
    if (feed === "aliceblue" || feed === "dev") {
      return { last: Number.NaN, changePct: Number.NaN, freshnessStatus: "offline" };
    }
    return null;
  }
  const row = {
    last: streamed?.last ?? baseLast ?? 0,
    changePct: streamed?.changePct ?? baseChange ?? 0,
    freshnessStatus: base?.freshnessStatus ?? "offline",
  };
  return mergeDisplayed(row, streamed, feed, streamDown, now);
}
