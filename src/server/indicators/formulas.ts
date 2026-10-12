export const FORMULA_VERSIONS = {
  rsi: "rsi-wilder-v1",
  ema: "ema-sma-seed-v1",
  cpr: "cpr-v1",
  atr: "atr-wilder-v1",
  supertrend: "supertrend-v1",
} as const;

export type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  openTime: string;
  closeTime: string;
  sourceTimestamp: string | null;
  freshnessStatus: "sample" | "stale" | "unavailable";
  qualityFlags: string[];
  complete: boolean;
};

/**
 * Wilder RSI.
 * Seed is the simple average of the first `period` gains and losses.
 * After that, averages use Wilder smoothing: (prev * (period - 1) + current) / period.
 * If both averages are zero, RSI is 50. If average loss is zero and average gain is not, RSI is 100.
 * Values before warm-up are null. Warm-up needs period + 1 closes.
 */
export function wilderRsi(closes: readonly number[], period = 14): Array<number | null> {
  if (period < 1) throw new Error("RSI period must be at least 1.");
  const result: Array<number | null> = closes.map(() => null);
  if (closes.length <= period) return result;

  let gainSum = 0;
  let lossSum = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = closes[index] - closes[index - 1];
    if (change > 0) gainSum += change;
    else lossSum += Math.abs(change);
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  result[period] = rsiFromAverages(avgGain, avgLoss);

  for (let index = period + 1; index < closes.length; index += 1) {
    const change = closes[index] - closes[index - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[index] = rsiFromAverages(avgGain, avgLoss);
  }
  return result;
}

function rsiFromAverages(avgGain: number, avgLoss: number): number {
  if (avgGain === 0 && avgLoss === 0) return 50;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * EMA seeded with the SMA of the first `period` closes.
 * alpha = 2 / (period + 1). Later values: alpha * close + (1 - alpha) * previous EMA.
 */
export function exponentialMovingAverage(closes: readonly number[], period = 20): Array<number | null> {
  if (period < 1) throw new Error("EMA period must be at least 1.");
  const result: Array<number | null> = closes.map(() => null);
  if (closes.length < period) return result;
  let seed = 0;
  for (let index = 0; index < period; index += 1) seed += closes[index];
  let previous = seed / period;
  result[period - 1] = previous;
  const alpha = 2 / (period + 1);
  for (let index = period; index < closes.length; index += 1) {
    previous = alpha * closes[index] + (1 - alpha) * previous;
    result[index] = previous;
  }
  return result;
}

export type CprValue = {
  pivot: number;
  bc: number;
  tc: number;
  top: number;
  bottom: number;
};

/** CPR from one completed session. Top and bottom are max/min of TC and BC. */
export function centralPivotRange(session: { high: number; low: number; close: number }): CprValue {
  const pivot = (session.high + session.low + session.close) / 3;
  const bc = (session.high + session.low) / 2;
  const tc = 2 * pivot - bc;
  return {
    pivot,
    bc,
    tc,
    top: Math.max(tc, bc),
    bottom: Math.min(tc, bc),
  };
}

function trueRange(current: { high: number; low: number; close: number }, previousClose: number | null): number {
  const range = current.high - current.low;
  if (previousClose === null) return range;
  return Math.max(range, Math.abs(current.high - previousClose), Math.abs(current.low - previousClose));
}

/**
 * Wilder ATR. The first bar uses high-low when there is no previous close.
 * Seed is the simple average of the first `period` true ranges, then Wilder smoothing.
 */
export function wilderAtr(
  bars: readonly { high: number; low: number; close: number }[],
  period = 14,
): Array<number | null> {
  if (period < 1) throw new Error("ATR period must be at least 1.");
  const result: Array<number | null> = bars.map(() => null);
  if (bars.length < period) return result;
  const ranges: number[] = [];
  for (let index = 0; index < bars.length; index += 1) {
    const previousClose = index === 0 ? null : bars[index - 1].close;
    ranges.push(trueRange(bars[index], previousClose));
  }
  let atr = 0;
  for (let index = 0; index < period; index += 1) atr += ranges[index];
  atr /= period;
  result[period - 1] = atr;
  for (let index = period; index < bars.length; index += 1) {
    atr = (atr * (period - 1) + ranges[index]) / period;
    result[index] = atr;
  }
  return result;
}

export type SuperTrendPoint = {
  value: number;
  trend: "up" | "down";
  finalUpper: number;
  finalLower: number;
} | null;

/**
 * SuperTrend on completed bars.
 * Bands are (high + low) / 2 ± multiplier * Wilder ATR.
 * A bar flips up only when close is strictly above the previous final upper band,
 * and down only when close is strictly below the previous final lower band.
 * Equality keeps the previous trend.
 * Defaults are ATR period 10 and multiplier 3. Formula version supertrend-v1.
 */
export function superTrend(
  bars: readonly { high: number; low: number; close: number }[],
  period = 10,
  multiplier = 3,
): SuperTrendPoint[] {
  const atr = wilderAtr(bars, period);
  const result: SuperTrendPoint[] = bars.map(() => null);
  let prevUpper: number | null = null;
  let prevLower: number | null = null;
  let prevTrend: "up" | "down" | null = null;

  for (let index = 0; index < bars.length; index += 1) {
    const atrValue = atr[index];
    if (atrValue === null) continue;
    const bar = bars[index];
    const mid = (bar.high + bar.low) / 2;
    const basicUpper = mid + multiplier * atrValue;
    const basicLower = mid - multiplier * atrValue;
    const previousClose = index === 0 ? bar.close : bars[index - 1].close;

    let finalUpper = basicUpper;
    if (prevUpper !== null && basicUpper >= prevUpper && previousClose <= prevUpper) {
      finalUpper = prevUpper;
    }
    let finalLower = basicLower;
    if (prevLower !== null && basicLower <= prevLower && previousClose >= prevLower) {
      finalLower = prevLower;
    }

    let trend: "up" | "down";
    if (prevTrend === null) {
      trend = bar.close >= mid ? "up" : "down";
    } else if (prevUpper !== null && bar.close > prevUpper) {
      trend = "up";
    } else if (prevLower !== null && bar.close < prevLower) {
      trend = "down";
    } else {
      trend = prevTrend;
    }

    result[index] = {
      value: trend === "up" ? finalLower : finalUpper,
      trend,
      finalUpper,
      finalLower,
    };
    prevUpper = finalUpper;
    prevLower = finalLower;
    prevTrend = trend;
  }
  return result;
}

export function lastNumber(values: readonly (number | null)[]): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null) return values[index];
  }
  return null;
}
