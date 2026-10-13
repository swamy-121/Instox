import { centralPivotRange, exponentialMovingAverage, lastNumber, wilderAtr, wilderRsi, type Candle } from "@/server/indicators/formulas";

export const TIP_CHECK_LIMITS = { free: 8, premium: 30 } as const;

export type CheckSide = "BUY" | "SELL" | "WAIT";

export type SymbolCheck = {
  side: CheckSide;
  agreement: number;
  reasons: string[];
  stop: number | null;
  target: number | null;
  note: string;
};

export function quotaAllows(used: number, tier: keyof typeof TIP_CHECK_LIMITS): boolean {
  return used < TIP_CHECK_LIMITS[tier];
}

/**
 * Points for trend, RSI, a prior high or low, and the pivot band.
 * Agreement is how far the two sides differ. It is not a chance of profit.
 */
export function checkSymbol(candles: Candle[]): SymbolCheck | null {
  const completed = candles.filter((candle) => candle.complete);
  if (completed.length < 21) return null;
  const closes = completed.map((candle) => candle.close);
  const last = completed[completed.length - 1];
  const previous = completed[completed.length - 2];
  if (!last || !previous || !(last.close > 0)) return null;
  const ema20 = lastNumber(exponentialMovingAverage(closes, 20));
  const ema50 = completed.length >= 50 ? lastNumber(exponentialMovingAverage(closes, 50)) : null;
  const rsi = lastNumber(wilderRsi(closes, 14));
  const atr = lastNumber(wilderAtr(completed, 14));
  const prior = completed.slice(-21, -1);
  const priorHigh = Math.max(...prior.map((candle) => candle.high));
  const priorLow = Math.min(...prior.map((candle) => candle.low));
  const cpr = centralPivotRange(previous);

  let bull = 0;
  let bear = 0;
  const reasons: string[] = [];
  if (ema20 !== null && last.close > ema20) {
    bull += 20;
    reasons.push("Price is above the 20-day average.");
  } else if (ema20 !== null && last.close < ema20) {
    bear += 20;
    reasons.push("Price is below the 20-day average.");
  }
  if (ema20 !== null && ema50 !== null && ema20 > ema50) {
    bull += 20;
    reasons.push("The 20-day average is above the 50-day average.");
  } else if (ema20 !== null && ema50 !== null && ema20 < ema50) {
    bear += 20;
    reasons.push("The 20-day average is below the 50-day average.");
  } else if (ema50 === null) {
    reasons.push("There are not enough bars for a 50-day average, so that check is left out.");
  }
  if (rsi !== null && rsi >= 55) {
    bull += 20;
    reasons.push("RSI is on the strong side.");
  } else if (rsi !== null && rsi <= 45) {
    bear += 20;
    reasons.push("RSI is on the weak side.");
  } else if (rsi !== null) {
    reasons.push("RSI is near the middle.");
  }
  if (last.close > priorHigh) {
    bull += 20;
    reasons.push("The close is above the prior 20 bars.");
  } else if (last.close < priorLow) {
    bear += 20;
    reasons.push("The close is below the prior 20 bars.");
  }
  if (last.close > cpr.top) {
    bull += 10;
    reasons.push("Price is above the pivot band.");
  } else if (last.close < cpr.bottom) {
    bear += 10;
    reasons.push("Price is below the pivot band.");
  } else {
    reasons.push("Price is inside the pivot band.");
  }

  const gap = bull - bear;
  const side: CheckSide = gap >= 20 ? "BUY" : gap <= -20 ? "SELL" : "WAIT";
  const agreement = Math.min(100, Math.abs(gap));
  const cushion = atr !== null && atr > 0 ? atr : last.close * 0.02;
  const stop = side === "BUY" ? round2(last.close - cushion * 1.5) : side === "SELL" ? round2(last.close + cushion * 1.5) : null;
  const target = side === "BUY" ? round2(last.close + cushion * 2) : side === "SELL" ? round2(Math.max(0.05, last.close - cushion * 2)) : null;

  return {
    side,
    agreement,
    reasons,
    stop: stop !== null && stop > 0 ? stop : null,
    target: target !== null && target > 0 ? target : null,
    note: "This is how the checks line up. It is not a chance of profit, and the stop and target are only a sketch.",
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
