import { exponentialMovingAverage, lastNumber, wilderRsi } from "@/server/indicators/formulas";
import type { BhavBar } from "@/server/research/parsers";

export type ConfidenceRow = {
  symbol: string;
  close: number;
  score: number;
  band: "stands out" | "mixed" | "weak";
  reasons: string[];
  rsi: number | null;
  trend: "up" | "down" | "flat" | "unknown";
  volumeRatio: number | null;
};

/**
 * A 0-100 reading from trend, RSI, volume, and a 20-session high.
 * 75 or more is "stands out". The number is how many checks line up, not a chance of profit.
 */
export function scoreHighConfidence(bars: BhavBar[]): Omit<ConfidenceRow, "symbol"> | null {
  if (bars.length < 50) return null;
  const ordered = [...bars].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  const closes = ordered.map((bar) => bar.close);
  const ema20 = lastNumber(exponentialMovingAverage(closes, 20));
  const ema50 = lastNumber(exponentialMovingAverage(closes, 50));
  const rsi = lastNumber(wilderRsi(closes, 14));
  const last = ordered[ordered.length - 1];
  const prior = ordered.slice(-21, -1);
  if (!last || prior.length < 20) return null;
  const priorHigh = Math.max(...prior.map((bar) => bar.high));
  const averageVolume = prior.reduce((sum, bar) => sum + bar.volume, 0) / prior.length;
  const volumeRatio = averageVolume > 0 ? round2(last.volume / averageVolume) : null;

  let score = 0;
  const reasons: string[] = [];
  let trend: ConfidenceRow["trend"] = "unknown";
  if (ema20 !== null && ema50 !== null) {
    if (last.close > ema20 && ema20 > ema50) {
      score += 30;
      trend = "up";
      reasons.push("Price is above a rising 20-day average.");
    } else if (last.close < ema20 && ema20 < ema50) {
      trend = "down";
      reasons.push("Price is below a falling 20-day average.");
    } else {
      trend = "flat";
      score += 10;
      reasons.push("The short and long averages are mixed.");
    }
  }
  if (rsi !== null && rsi >= 50 && rsi <= 68) {
    score += 25;
    reasons.push("RSI is firm without looking stretched.");
  } else if (rsi !== null && rsi > 68) {
    score += 8;
    reasons.push("RSI is high, so the move may already be stretched.");
  } else if (rsi !== null) {
    reasons.push("RSI is soft.");
  }
  if (volumeRatio !== null && volumeRatio >= 1.2) {
    score += 25;
    reasons.push("Volume is above the recent average.");
  } else {
    reasons.push("Volume is not above the recent average.");
  }
  if (last.close > priorHigh) {
    score += 20;
    reasons.push("The close is above the prior 20-session high.");
  } else {
    reasons.push("The close is still inside the prior 20-session range.");
  }

  const band: ConfidenceRow["band"] = score >= 75 ? "stands out" : score >= 45 ? "mixed" : "weak";
  return {
    close: round2(last.close),
    score,
    band,
    reasons,
    rsi: rsi === null ? null : round2(rsi),
    trend,
    volumeRatio,
  };
}

export function rankHighConfidence(series: Record<string, BhavBar[]>): ConfidenceRow[] {
  const rows: ConfidenceRow[] = [];
  for (const [symbol, bars] of Object.entries(series)) {
    const scored = scoreHighConfidence(bars);
    if (scored) rows.push({ symbol, ...scored });
  }
  return rows.sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
