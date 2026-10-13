import { eq, inArray, sql } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { istDay } from "@/server/tips/evaluate";
import { getDb } from "@/server/db/client";
import { dailyBars, optionOi } from "@/server/db/schema";
import type { Candle } from "@/server/indicators/formulas";
import { sampleCandleEnd, sampleCandles } from "@/server/market-data/candles";
import { sampleChain } from "@/server/research/chain";
import { parseBhavcopyCsv, parseOiCsv, type BhavBar, type OiRow } from "@/server/research/parsers";

export type ResearchSource = "sample" | "bhavcopy" | "mixed" | "nse";

export function candlesToBars(symbol: string, candles: Candle[]): BhavBar[] {
  return candles
    .filter((candle) => candle.complete)
    .map((candle, index) => ({
      symbol,
      tradeDate: istDay(candle.closeTime),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: 100_000 + ((index * 37 + symbol.length * 13) % 80) * 1_000,
    }));
}

export function barsToCandles(bars: BhavBar[]): Candle[] {
  return [...bars]
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
    .map((bar) => ({
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      openTime: `${bar.tradeDate}T03:45:00.000Z`,
      closeTime: `${bar.tradeDate}T10:00:00.000Z`,
      sourceTimestamp: `${bar.tradeDate}T10:00:00.000Z`,
      freshnessStatus: "sample" as const,
      qualityFlags: [bar.symbol ? "end-of-day" : "sample"],
      complete: true,
    }));
}

export async function loadResearchSeries(symbols: string[], now = new Date()): Promise<{
  source: "sample" | "bhavcopy" | "mixed";
  notice: string;
  bars: Record<string, BhavBar[]>;
  candles: Record<string, Candle[]>;
}> {
  const unique = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
  const stored = unique.length === 0 ? [] : await getDb().select().from(dailyBars).where(inArray(dailyBars.symbol, unique));
  const bySymbol = new Map<string, BhavBar[]>();
  for (const row of stored) {
    const list = bySymbol.get(row.symbol) ?? [];
    list.push({
      symbol: row.symbol,
      tradeDate: row.tradeDate,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    });
    bySymbol.set(row.symbol, list);
  }

  const bars: Record<string, BhavBar[]> = {};
  const candles: Record<string, Candle[]> = {};
  let fromFile = 0;
  for (const symbol of unique) {
    const fileBars = bySymbol.get(symbol) ?? [];
    if (fileBars.length >= 50) {
      bars[symbol] = fileBars;
      candles[symbol] = barsToCandles(fileBars);
      fromFile += 1;
      continue;
    }
    const sample = sampleCandles(symbol, 70, sampleCandleEnd(now)).filter((candle) => Date.parse(candle.closeTime) <= now.getTime());
    candles[symbol] = sample;
    bars[symbol] = candlesToBars(symbol, sample);
  }

  const source = fromFile === 0 ? "sample" : fromFile === unique.length ? "bhavcopy" : "mixed";
  const notice = source === "bhavcopy"
    ? "These rows come from the end-of-day file saved in Instox."
    : source === "mixed"
      ? "Some names use the end-of-day file. The rest are sample prices."
      : "These are sample prices. Add BHAVCOPY_URL when you have an end-of-day equity file.";
  return { source, notice, bars, candles };
}

export async function refreshBhavcopy(): Promise<{ loaded: number; notice: string }> {
  const url = process.env.BHAVCOPY_URL?.trim();
  if (!url) return { loaded: 0, notice: "No end-of-day equity file is set, so sample prices stay in use." };
  let text = "";
  try {
    text = await fetchText(url);
  } catch {
    return { loaded: 0, notice: "The equity file could not be read. Sample prices stay in use." };
  }
  if (text.startsWith("PK")) return { loaded: 0, notice: "That file is a zip. Point BHAVCOPY_URL at the CSV inside it." };
  const parsed = parseBhavcopyCsv(text);
  if (parsed.length === 0) return { loaded: 0, notice: "The equity file had no rows we could read." };
  await upsertBars(parsed);
  return { loaded: parsed.length, notice: `Saved ${parsed.length} equity rows from the end-of-day file.` };
}

export async function refreshOpenInterest(): Promise<{ loaded: number; notice: string }> {
  const url = process.env.NSE_OI_URL?.trim();
  if (!url) return { loaded: 0, notice: "No option file is set, so the chain stays on sample data." };
  let text = "";
  try {
    text = await fetchText(url);
  } catch {
    return { loaded: 0, notice: "The option file could not be read. The sample chain stays in use." };
  }
  if (text.startsWith("PK")) return { loaded: 0, notice: "That file is a zip. Point NSE_OI_URL at the CSV inside it." };
  const parsed = parseOiCsv(text);
  if (parsed.length === 0) return { loaded: 0, notice: "The option file had no call or put rows we could read." };
  await upsertOi(parsed);
  return { loaded: parsed.length, notice: `Saved ${parsed.length} option rows from the end-of-day file.` };
}

export async function loadOptionChain(underlying: string, spot: number, now = new Date()): Promise<{
  rows: OiRow[];
  source: "sample" | "nse";
  tradeDate: string;
  notice: string;
}> {
  const symbol = underlying.trim().toUpperCase();
  const stored = await getDb().select().from(optionOi).where(eq(optionOi.underlying, symbol));
  if (stored.length > 0) {
    const tradeDate = stored.map((row) => row.tradeDate).sort().at(-1) ?? istDay(now);
    const rows = stored
      .filter((row) => row.tradeDate === tradeDate)
      .map((row) => ({
        underlying: row.underlying,
        tradeDate: row.tradeDate,
        expiry: row.expiry,
        strike: row.strike,
        optionType: row.optionType === "PE" ? "PE" as const : "CE" as const,
        openInterest: row.openInterest,
        oiChange: row.oiChange,
        ltp: row.ltp,
        iv: row.iv,
        volume: row.volume,
      }));
    return { rows, source: "nse", tradeDate, notice: "These rows come from the end-of-day option file." };
  }
  const tradeDate = istDay(now);
  return {
    rows: sampleChain(symbol, spot > 0 ? spot : 100, tradeDate),
    source: "sample",
    tradeDate,
    notice: "This is a sample chain, not the exchange file. Set NSE_OI_URL when you have an end-of-day option file.",
  };
}

export async function storedBarsFor(symbols: string[]): Promise<Record<string, BhavBar[]>> {
  if (symbols.length === 0) return {};
  const rows = await getDb().select().from(dailyBars).where(inArray(dailyBars.symbol, symbols));
  const grouped: Record<string, BhavBar[]> = {};
  for (const row of rows) {
    const list = grouped[row.symbol] ?? [];
    list.push({
      symbol: row.symbol,
      tradeDate: row.tradeDate,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    });
    grouped[row.symbol] = list;
  }
  return grouped;
}

async function upsertBars(parsed: BhavBar[]): Promise<void> {
  const db = getDb();
  for (let index = 0; index < parsed.length; index += 200) {
    const chunk = parsed.slice(index, index + 200).map((bar) => ({
      symbol: bar.symbol,
      tradeDate: bar.tradeDate,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      source: "bhavcopy",
    }));
    await db
      .insert(dailyBars)
      .values(chunk)
      .onConflictDoUpdate({
        target: [dailyBars.symbol, dailyBars.tradeDate],
        set: {
          open: sql`excluded.open`,
          high: sql`excluded.high`,
          low: sql`excluded.low`,
          close: sql`excluded.close`,
          volume: sql`excluded.volume`,
          source: sql`excluded.source`,
        },
      });
  }
}

async function upsertOi(parsed: OiRow[]): Promise<void> {
  const db = getDb();
  for (let index = 0; index < parsed.length; index += 200) {
    const chunk = parsed.slice(index, index + 200).map((row) => ({
      tradeDate: row.tradeDate,
      underlying: row.underlying,
      expiry: row.expiry,
      strike: row.strike,
      optionType: row.optionType,
      openInterest: row.openInterest,
      oiChange: row.oiChange,
      ltp: row.ltp,
      iv: row.iv,
      volume: row.volume,
      source: "nse",
    }));
    await db
      .insert(optionOi)
      .values(chunk)
      .onConflictDoUpdate({
        target: [optionOi.tradeDate, optionOi.underlying, optionOi.expiry, optionOi.strike, optionOi.optionType],
        set: {
          openInterest: sql`excluded.open_interest`,
          oiChange: sql`excluded.oi_change`,
          ltp: sql`excluded.ltp`,
          iv: sql`excluded.iv`,
          volume: sql`excluded.volume`,
          source: sql`excluded.source`,
        },
      });
  }
}

async function fetchText(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError(422, "BUSINESS_RULE_FAILED", "The file address is not a valid URL.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new AppError(422, "BUSINESS_RULE_FAILED", "The file address must be an http or https URL.");
  }
  const response = await fetch(parsed, {
    signal: AbortSignal.timeout(12_000),
    headers: { "user-agent": "Instox/1.0", accept: "text/csv,text/plain,*/*" },
  });
  if (!response.ok) throw new AppError(502, "PROVIDER_UNAVAILABLE", "The file could not be read.");
  return response.text();
}
