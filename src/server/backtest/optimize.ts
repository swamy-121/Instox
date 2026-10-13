import type { Candle } from "@/server/indicators/formulas";
import { walkEmaCross, type BacktestTrade } from "@/server/backtest/run";

export type OptimizeRow = {
  emaPeriod: number;
  trades: number;
  gains: number;
  losses: number;
  netReturnPct: number | null;
  profitFactor: number | null;
};

export type OptimizeResult = {
  rows: OptimizeRow[];
  pickedPeriod: number | null;
  minTrades: number;
  note: string;
};

const DEFAULT_PERIODS = [8, 12, 20, 34];

/**
 * Tries a few EMA lengths on the same prices.
 * The highlighted row only won on this sample. Another stretch can rank them differently.
 */
export function optimizeEmaPeriods(
  candles: Candle[],
  options?: { periods?: number[]; feeBps?: number; slippageBps?: number; minTrades?: number },
): OptimizeResult {
  const periods = options?.periods ?? DEFAULT_PERIODS;
  const feeBps = options?.feeBps ?? 10;
  const slippageBps = options?.slippageBps ?? 5;
  const minTrades = options?.minTrades ?? 2;
  const rows = periods.map((emaPeriod) => summarize(emaPeriod, walkEmaCross(candles, emaPeriod, feeBps, slippageBps)));
  const eligible = rows.filter((row) => row.trades >= minTrades && row.profitFactor !== null);
  const picked = eligible.sort((a, b) => (b.profitFactor ?? 0) - (a.profitFactor ?? 0) || a.emaPeriod - b.emaPeriod)[0];
  return {
    rows,
    pickedPeriod: picked?.emaPeriod ?? null,
    minTrades,
    note: picked
      ? `EMA ${picked.emaPeriod} ranked highest on this sample, with at least ${minTrades} closed trades. Another set of prices can rank them differently. This is not a forecast.`
      : `None of these lengths had ${minTrades} closed trades and both wins and losses, so nothing is highlighted.`,
  };
}

function summarize(emaPeriod: number, trades: BacktestTrade[]): OptimizeRow {
  const gains = trades.filter((trade) => trade.outcome === "gain");
  const losses = trades.filter((trade) => trade.outcome === "loss");
  const gainSum = gains.reduce((sum, trade) => sum + trade.netReturnPct, 0);
  const lossSum = losses.reduce((sum, trade) => sum + Math.abs(trade.netReturnPct), 0);
  const profitFactor = lossSum > 0 ? round2(gainSum / lossSum) : null;
  const netReturnPct = trades.length === 0 ? null : round2(trades.reduce((sum, trade) => sum + trade.netReturnPct, 0));
  return {
    emaPeriod,
    trades: trades.length,
    gains: gains.length,
    losses: losses.length,
    netReturnPct,
    profitFactor,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
