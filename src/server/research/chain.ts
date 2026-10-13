import type { OiRow } from "@/server/research/parsers";

export type ChainSummary = {
  callOi: number;
  putOi: number;
  pcr: number | null;
  maxPain: number | null;
  callWall: { strike: number; openInterest: number } | null;
  putWall: { strike: number; openInterest: number } | null;
  bias: "bullish" | "bearish" | "balanced";
  biasNote: string;
};

export type OptionIdea = {
  optionType: "CE" | "PE";
  strike: number;
  expiry: string;
  premium: number;
  stopPremium: number;
  targetPremium: number;
  openInterest: number;
  note: string;
};

export function summarizeChain(rows: OiRow[]): ChainSummary {
  const calls = rows.filter((row) => row.optionType === "CE");
  const puts = rows.filter((row) => row.optionType === "PE");
  const callOi = calls.reduce((sum, row) => sum + row.openInterest, 0);
  const putOi = puts.reduce((sum, row) => sum + row.openInterest, 0);
  const pcr = callOi > 0 ? round2(putOi / callOi) : null;
  const callWall = wall(calls);
  const putWall = wall(puts);
  const maxPain = painStrike(rows);
  let bias: ChainSummary["bias"] = "balanced";
  let biasNote = "Put and call interest are close, so there is no lean from open interest alone.";
  if (pcr !== null && pcr >= 1.2) {
    bias = "bullish";
    biasNote = "Put interest is heavier. That often sits under price as a cushion, and it can fail.";
  } else if (pcr !== null && pcr <= 0.8) {
    bias = "bearish";
    biasNote = "Call interest is heavier. That often sits above price as a ceiling, and it can fail.";
  }
  return { callOi, putOi, pcr, maxPain, callWall, putWall, bias, biasNote };
}

/** Strike in the chain where writers would feel the least pain if price settled there. */
export function painStrike(rows: OiRow[]): number | null {
  const strikes = [...new Set(rows.map((row) => row.strike))].sort((a, b) => a - b);
  if (strikes.length === 0) return null;
  let best: { strike: number; pain: number } | null = null;
  for (const settlement of strikes) {
    let pain = 0;
    for (const row of rows) {
      if (row.optionType === "CE") pain += Math.max(0, settlement - row.strike) * row.openInterest;
      else pain += Math.max(0, row.strike - settlement) * row.openInterest;
    }
    if (!best || pain < best.pain) best = { strike: settlement, pain };
  }
  return best ? best.strike : null;
}

export function optionBuyingIdeas(spot: number, rows: OiRow[], bias: ChainSummary["bias"]): OptionIdea[] {
  if (bias === "balanced" || !(spot > 0)) return [];
  const optionType = bias === "bullish" ? "CE" : "PE";
  const candidates = rows.filter((row) => row.optionType === optionType && row.ltp > 0 && row.openInterest > 0 && row.volume > 0);
  const ordered = bias === "bullish"
    ? candidates.filter((row) => row.strike >= spot).sort((a, b) => a.strike - b.strike)
    : candidates.filter((row) => row.strike <= spot).sort((a, b) => b.strike - a.strike);
  const pick = ordered[0];
  if (!pick) return [];
  return [
    {
      optionType,
      strike: pick.strike,
      expiry: pick.expiry,
      premium: round2(pick.ltp),
      stopPremium: round2(pick.ltp * 0.7),
      targetPremium: round2(pick.ltp * 1.5),
      openInterest: pick.openInterest,
      note: "A bought option loses value as time passes. The stop and target are sketches on the premium, not a promise.",
    },
  ];
}

export function sampleChain(underlying: string, spot: number, tradeDate: string): OiRow[] {
  const step = spot >= 10000 ? 100 : spot >= 2000 ? 50 : 10;
  const atm = Math.round(spot / step) * step;
  const expiry = nextThursday(tradeDate);
  const rows: OiRow[] = [];
  for (let offset = -6; offset <= 6; offset += 1) {
    const strike = atm + offset * step;
    const distance = Math.abs(offset);
    const callOi = 120_000 + (6 - distance) * 18_000 + (offset > 0 ? 40_000 : 0);
    const putOi = 110_000 + (6 - distance) * 16_000 + (offset < 0 ? 55_000 : 0);
    rows.push(contract(underlying, tradeDate, expiry, strike, "CE", callOi, spot));
    rows.push(contract(underlying, tradeDate, expiry, strike, "PE", putOi, spot));
  }
  return rows;
}

function contract(
  underlying: string,
  tradeDate: string,
  expiry: string,
  strike: number,
  optionType: "CE" | "PE",
  openInterest: number,
  spot: number,
): OiRow {
  const distance = Math.abs(strike - spot) / spot;
  const intrinsic = optionType === "CE" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  const ltp = Math.max(0.5, intrinsic * 0.35 + spot * 0.012 * (1 - Math.min(distance, 0.2)));
  return {
    underlying,
    tradeDate,
    expiry,
    strike,
    optionType,
    openInterest,
    oiChange: Math.round(openInterest * 0.04),
    ltp: round2(ltp),
    iv: round2(14 + distance * 40),
    volume: Math.round(openInterest * 0.08),
  };
}

function wall(rows: OiRow[]): { strike: number; openInterest: number } | null {
  let best: OiRow | null = null;
  for (const row of rows) {
    if (!best || row.openInterest > best.openInterest) best = row;
  }
  return best ? { strike: best.strike, openInterest: best.openInterest } : null;
}

function nextThursday(tradeDate: string): string {
  const parsed = Date.parse(`${tradeDate}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) return tradeDate;
  const date = new Date(parsed);
  const day = date.getUTCDay();
  const add = (4 - day + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + add);
  return date.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
