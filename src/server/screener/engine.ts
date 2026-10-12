import { AppError } from "@/lib/errors";
import {
  FORMULA_VERSIONS,
  centralPivotRange,
  exponentialMovingAverage,
  lastNumber,
  superTrend,
  wilderAtr,
  wilderRsi,
  type Candle,
} from "@/server/indicators/formulas";
import { assertIndicatorEnabled, type IndicatorFlags } from "@/server/indicators/flags";
import { assertOhlc } from "@/server/market-data/candles";
import { isInstrumentActive, type InstrumentMaster } from "@/server/market-data/instruments";

export type ScreenerFilter =
  | { indicator: "rsi"; operator: "gt" | "lt" | "gte" | "lte"; value: number }
  | { indicator: "ema"; operator: "above" | "below" }
  | { indicator: "cpr"; operator: "above" | "below" | "inside" }
  | { indicator: "atr"; operator: "gt" | "lt"; value: number }
  | { indicator: "supertrend"; operator: "up" | "down" };

export type ScreenerRow = {
  symbol: string;
  segment: InstrumentMaster["segment"];
  last: number;
  interval: "1d";
  dataLabel: "Sample data";
  live: false;
  freshnessStatus: Candle["freshnessStatus"];
  sourceTimestamp: string | null;
  candleCloseTime: string;
  formulaVersions: Record<string, string>;
  indicators: {
    rsi: number | null;
    ema: number | null;
    cpr: ReturnType<typeof centralPivotRange> | null;
    atr: number | null;
    supertrend: "up" | "down" | null;
  };
  matched: string[];
};

export type ScreenerOutput = {
  results: ScreenerRow[];
  skipped: { symbol: string; reason: string }[];
  combine: "and";
  completedCandlesOnly: true;
};

function completed(candles: Candle[], now: Date): Candle[] {
  return candles.filter((candle) => candle.complete && Date.parse(candle.closeTime) <= now.getTime());
}

function matches(filter: ScreenerFilter, row: ScreenerRow["indicators"], close: number): boolean {
  if (filter.indicator === "rsi") {
    if (row.rsi === null) return false;
    if (filter.operator === "gt") return row.rsi > filter.value;
    if (filter.operator === "lt") return row.rsi < filter.value;
    if (filter.operator === "gte") return row.rsi >= filter.value;
    return row.rsi <= filter.value;
  }
  if (filter.indicator === "ema") {
    if (row.ema === null) return false;
    return filter.operator === "above" ? close > row.ema : close < row.ema;
  }
  if (filter.indicator === "cpr") {
    if (!row.cpr) return false;
    if (filter.operator === "above") return close > row.cpr.top;
    if (filter.operator === "below") return close < row.cpr.bottom;
    return close <= row.cpr.top && close >= row.cpr.bottom;
  }
  if (filter.indicator === "atr") {
    if (row.atr === null) return false;
    return filter.operator === "gt" ? row.atr > filter.value : row.atr < filter.value;
  }
  if (row.supertrend === null) return false;
  return row.supertrend === filter.operator;
}

export function runScreener(input: {
  instruments: InstrumentMaster[];
  candlesBySymbol: Record<string, Candle[]>;
  filters: ScreenerFilter[];
  flags: IndicatorFlags;
  now: Date;
  maxAgeMs: number;
  periods?: { rsi?: number; ema?: number; atr?: number; supertrend?: number; supertrendMultiplier?: number };
}): ScreenerOutput {
  for (const filter of input.filters) {
    if (filter.indicator === "atr" || filter.indicator === "supertrend" || filter.indicator === "rsi" || filter.indicator === "ema" || filter.indicator === "cpr") {
      try {
        assertIndicatorEnabled(input.flags, filter.indicator);
      } catch {
        throw new AppError(422, "BUSINESS_RULE_FAILED", `${filter.indicator.toUpperCase()} is turned off until its formula flag is enabled.`);
      }
    }
  }

  const periods = {
    rsi: input.periods?.rsi ?? 14,
    ema: input.periods?.ema ?? 20,
    atr: input.periods?.atr ?? 14,
    supertrend: input.periods?.supertrend ?? 10,
    supertrendMultiplier: input.periods?.supertrendMultiplier ?? 3,
  };
  const results: ScreenerRow[] = [];
  const skipped: { symbol: string; reason: string }[] = [];

  for (const instrument of input.instruments) {
    if (!isInstrumentActive(instrument, input.now)) {
      skipped.push({ symbol: instrument.symbol, reason: "Not in the active universe." });
      continue;
    }
    const raw = input.candlesBySymbol[instrument.symbol] ?? [];
    const candles = completed(raw, input.now);
    if (candles.length === 0) {
      skipped.push({ symbol: instrument.symbol, reason: "No completed candles." });
      continue;
    }
    if (candles.some((candle) => !assertOhlc(candle))) {
      skipped.push({ symbol: instrument.symbol, reason: "Malformed OHLC." });
      continue;
    }
    const last = candles[candles.length - 1];
    if (last.freshnessStatus === "stale" || last.freshnessStatus === "unavailable") {
      skipped.push({ symbol: instrument.symbol, reason: "Candle is stale or unavailable." });
      continue;
    }
    if (last.freshnessStatus !== "sample" && last.sourceTimestamp) {
      const age = input.now.getTime() - Date.parse(last.sourceTimestamp);
      if (age > input.maxAgeMs) {
        skipped.push({ symbol: instrument.symbol, reason: "Candle is older than the freshness limit." });
        continue;
      }
    }

    const closes = candles.map((candle) => candle.close);
    const rsi = input.flags.rsi ? lastNumber(wilderRsi(closes, periods.rsi)) : null;
    const ema = input.flags.ema ? lastNumber(exponentialMovingAverage(closes, periods.ema)) : null;
    const previous = candles.length >= 2 ? candles[candles.length - 2] : null;
    const cpr = input.flags.cpr && previous ? centralPivotRange(previous) : null;
    const atr = input.flags.atr ? lastNumber(wilderAtr(candles, periods.atr)) : null;
    const trend = input.flags.supertrend ? superTrend(candles, periods.supertrend, periods.supertrendMultiplier) : [];
    const lastTrend = trend.length > 0 ? trend[trend.length - 1] : null;
    const indicators = {
      rsi,
      ema,
      cpr,
      atr,
      supertrend: lastTrend ? lastTrend.trend : null,
    };
    const matched = input.filters.map((filter) => {
      const ok = matches(filter, indicators, last.close);
      return ok ? `${filter.indicator}:${filter.operator}` : "";
    }).filter(Boolean);
    if (input.filters.length > 0 && matched.length !== input.filters.length) continue;

    const formulaVersions: Record<string, string> = {};
    if (input.flags.rsi) formulaVersions.rsi = FORMULA_VERSIONS.rsi;
    if (input.flags.ema) formulaVersions.ema = FORMULA_VERSIONS.ema;
    if (input.flags.cpr) formulaVersions.cpr = FORMULA_VERSIONS.cpr;
    if (input.flags.atr) formulaVersions.atr = FORMULA_VERSIONS.atr;
    if (input.flags.supertrend) formulaVersions.supertrend = FORMULA_VERSIONS.supertrend;

    results.push({
      symbol: instrument.symbol,
      segment: instrument.segment,
      last: last.close,
      interval: "1d",
      dataLabel: "Sample data",
      live: false,
      freshnessStatus: last.freshnessStatus,
      sourceTimestamp: last.sourceTimestamp,
      candleCloseTime: last.closeTime,
      formulaVersions,
      indicators,
      matched,
    });
  }

  return { results, skipped, combine: "and", completedCandlesOnly: true };
}
