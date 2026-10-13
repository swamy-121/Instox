import type { Candle } from "@/server/indicators/formulas";
import { exponentialMovingAverage, lastNumber, wilderRsi } from "@/server/indicators/formulas";

export type BoardCard = {
  symbol: string;
  last: number;
  rsi: number | null;
  rangePct: number | null;
  fit: "closer" | "looser";
  note: string;
  callStrike: number | null;
  putStrike: number | null;
};

export type PulseBoards = {
  optionSelling: BoardCard[];
  sideways: BoardCard[];
};

type Prepared = {
  symbol: string;
  last: number;
  rsi: number | null;
  rangePct: number | null;
  emaGapPct: number | null;
};

/** Option-selling names are quiet ranges. Sideways names have short and long averages close together. */
export function buildPulseBoards(input: Array<{ symbol: string; candles: Candle[] }>): PulseBoards {
  const prepared = input.map(prepare).filter((row): row is Prepared => row !== null);
  const optionSelling = prepared
    .filter((row) => row.rangePct !== null && row.rangePct <= 14 && row.rsi !== null && row.rsi >= 35 && row.rsi <= 65)
    .map((row) => {
      const closer = row.rangePct !== null && row.rangePct <= 8 && row.rsi !== null && row.rsi >= 42 && row.rsi <= 58;
      const step = strikeStep(row.last);
      return {
        symbol: row.symbol,
        last: round2(row.last),
        rsi: row.rsi,
        rangePct: row.rangePct,
        fit: closer ? "closer" as const : "looser" as const,
        note: closer
          ? "Price has stayed in a tight band, with RSI near the middle."
          : "The band is a bit wide, so this is only a loose match.",
        callStrike: Math.ceil((row.last * 1.02) / step) * step,
        putStrike: Math.floor((row.last * 0.98) / step) * step,
      };
    })
    .sort(byFit);

  const sideways = prepared
    .filter((row) => row.emaGapPct !== null && row.emaGapPct <= 3 && row.rsi !== null && row.rsi >= 40 && row.rsi <= 60)
    .map((row) => {
      const closer = row.emaGapPct !== null && row.emaGapPct <= 1.2 && row.rsi !== null && row.rsi >= 45 && row.rsi <= 55;
      return {
        symbol: row.symbol,
        last: round2(row.last),
        rsi: row.rsi,
        rangePct: row.rangePct,
        fit: closer ? "closer" as const : "looser" as const,
        note: closer
          ? "The 20-day and 50-day averages are close, and RSI is near the middle."
          : "The averages are not far apart, but the fit is loose.",
        callStrike: null,
        putStrike: null,
      };
    })
    .sort(byFit);

  return { optionSelling, sideways };
}

function prepare(input: { symbol: string; candles: Candle[] }): Prepared | null {
  const candles = input.candles.filter((candle) => candle.complete);
  if (candles.length < 20) return null;
  const last = candles[candles.length - 1]?.close;
  if (!last || last <= 0) return null;
  const closes = candles.map((candle) => candle.close);
  const rsi = lastNumber(wilderRsi(closes, 14));
  const window = candles.slice(-15);
  const high = Math.max(...window.map((candle) => candle.high));
  const low = Math.min(...window.map((candle) => candle.low));
  const ema20 = lastNumber(exponentialMovingAverage(closes, 20));
  const ema50 = candles.length >= 50 ? lastNumber(exponentialMovingAverage(closes, 50)) : null;
  const emaGapPct = ema20 !== null && ema50 !== null && ema50 !== 0 ? round2((Math.abs(ema20 - ema50) / Math.abs(ema50)) * 100) : null;
  return {
    symbol: input.symbol,
    last,
    rsi: rsi === null ? null : round2(rsi),
    rangePct: round2(((high - low) / last) * 100),
    emaGapPct,
  };
}

function byFit(a: BoardCard, b: BoardCard): number {
  if (a.fit !== b.fit) return a.fit === "closer" ? -1 : 1;
  return (a.rangePct ?? 99) - (b.rangePct ?? 99);
}

function strikeStep(last: number): number {
  if (last >= 10000) return 100;
  if (last >= 2000) return 50;
  if (last >= 500) return 10;
  return 5;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
