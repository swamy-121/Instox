import backtestFile from "../../../config/backtest.json";
import type { Candle } from "@/server/indicators/formulas";
import { exponentialMovingAverage } from "@/server/indicators/formulas";

export type BacktestTrade = {
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  grossReturnPct: number;
  netReturnPct: number;
  outcome: "gain" | "loss" | "flat";
};

export type BacktestResult = {
  version: string;
  hypothetical: true;
  label: "Hypothetical";
  dataLabel: "Sample data";
  live: false;
  feeBps: number;
  slippageBps: number;
  note: string;
  trades: BacktestTrade[];
  losses: number;
  gains: number;
  netReturnPct: number | null;
};

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Slippage worsens the fill. Fees reduce proceeds and increase cost. Losses stay in the result. */
export function applyCosts(entry: number, exit: number, feeBps: number, slippageBps: number): Pick<BacktestTrade, "grossReturnPct" | "netReturnPct" | "outcome"> {
  const slip = slippageBps / 10_000;
  const fee = feeBps / 10_000;
  const entryCost = entry * (1 + slip) * (1 + fee);
  const exitProceeds = exit * (1 - slip) * (1 - fee);
  const gross = (exit / entry - 1) * 100;
  const net = (exitProceeds / entryCost - 1) * 100;
  const netReturnPct = round4(net);
  return {
    grossReturnPct: round4(gross),
    netReturnPct,
    outcome: netReturnPct < 0 ? "loss" : netReturnPct > 0 ? "gain" : "flat",
  };
}

export function walkEmaCross(
  candles: Candle[],
  emaPeriod: number,
  feeBps: number,
  slippageBps: number,
): BacktestTrade[] {
  const ema = exponentialMovingAverage(candles.map((candle) => candle.close), emaPeriod);
  const trades: BacktestTrade[] = [];
  let entry: { index: number } | null = null;
  for (let index = 1; index < candles.length; index += 1) {
    const previousEma = ema[index - 1];
    const currentEma = ema[index];
    if (previousEma === null || currentEma === null) continue;
    const crossedUp = candles[index - 1].close <= previousEma && candles[index].close > currentEma;
    const crossedDown = candles[index].close < currentEma;
    if (!entry && crossedUp) {
      entry = { index };
      continue;
    }
    if (entry && crossedDown) {
      trades.push(tradeFrom(candles, entry.index, index, feeBps, slippageBps));
      entry = null;
    }
  }
  if (entry && entry.index < candles.length - 1) {
    trades.push(tradeFrom(candles, entry.index, candles.length - 1, feeBps, slippageBps));
  }
  return trades;
}

function tradeFrom(candles: Candle[], entryIndex: number, exitIndex: number, feeBps: number, slippageBps: number): BacktestTrade {
  const entryPrice = candles[entryIndex].close;
  const exitPrice = candles[exitIndex].close;
  return {
    entryTime: candles[entryIndex].closeTime,
    exitTime: candles[exitIndex].closeTime,
    entryPrice,
    exitPrice,
    ...applyCosts(entryPrice, exitPrice, feeBps, slippageBps),
  };
}

export function runSampleBacktest(candles: Candle[], options?: { feeBps?: number; slippageBps?: number; emaPeriod?: number }): BacktestResult {
  const feeBps = options?.feeBps ?? backtestFile.feeBps;
  const slippageBps = options?.slippageBps ?? backtestFile.slippageBps;
  const emaPeriod = options?.emaPeriod ?? backtestFile.emaPeriod;
  const trades = walkEmaCross(candles, emaPeriod, feeBps, slippageBps);
  const losses = trades.filter((trade) => trade.outcome === "loss").length;
  const gains = trades.filter((trade) => trade.outcome === "gain").length;
  const netReturnPct = trades.length === 0 ? null : round4(trades.reduce((sum, trade) => sum + trade.netReturnPct, 0));
  return {
    version: backtestFile.version,
    hypothetical: true,
    label: "Hypothetical",
    dataLabel: "Sample data",
    live: false,
    feeBps,
    slippageBps,
    note: backtestFile.note,
    trades,
    losses,
    gains,
    netReturnPct,
  };
}
