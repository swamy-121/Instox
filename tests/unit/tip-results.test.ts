import { describe, expect, it } from "vitest";
import { optimizeEmaPeriods } from "@/server/backtest/optimize";
import type { Candle } from "@/server/indicators/formulas";
import { rankHighConfidence, scoreHighConfidence } from "@/server/research/confidence";
import { buildPulseBoards } from "@/server/research/boards";
import { optionBuyingIdeas, painStrike, sampleChain, summarizeChain } from "@/server/research/chain";
import { checkSymbol, quotaAllows } from "@/server/research/check";
import { supportResistance } from "@/server/research/levels";
import { parseBhavcopyCsv, parseOiCsv, parseTradeDay, type BhavBar } from "@/server/research/parsers";
import {
  barsForEvaluation,
  evaluateTipBar,
  evaluateTipSeries,
  istDay,
  resultNote,
  wantsResultAlert,
  type EvalTip,
} from "@/server/tips/evaluate";
import { rankRecommended } from "@/server/tips/recommend";

const buy: EvalTip = {
  side: "BUY",
  stopLoss: 90,
  targets: [
    { label: "T1", price: 110 },
    { label: "T2", price: 120 },
  ],
  publishedAt: "2026-10-10T04:00:00.000Z",
  expiresAt: "2026-10-20T10:00:00.000Z",
  status: "published",
};

function bar(tradeDate: string, open: number, high: number, low: number, close: number) {
  return { tradeDate, open, high, low, close };
}

function dayBars(start: number, step: number, count: number, volume: number): BhavBar[] {
  const bars: BhavBar[] = [];
  for (let index = 0; index < count; index += 1) {
    const close = start + index * step;
    const date = new Date(Date.UTC(2026, 0, 1 + index));
    bars.push({
      symbol: "DEMO",
      tradeDate: date.toISOString().slice(0, 10),
      open: close - step * 0.2,
      high: close + Math.abs(step) * 0.3,
      low: close - Math.abs(step) * 0.4,
      close,
      volume,
    });
  }
  return bars;
}

function candle(close: number, index: number): Candle {
  const closeTime = new Date(Date.UTC(2026, 0, 1 + index, 10)).toISOString();
  return {
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    openTime: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
    closeTime,
    sourceTimestamp: closeTime,
    freshnessStatus: "sample",
    qualityFlags: ["sample"],
    complete: true,
  };
}

describe("tip result evaluation", () => {
  it("closes a buy on the furthest target the bar reached", () => {
    const decision = evaluateTipBar(buy, bar("2026-10-13", 100, 121, 95, 118));
    expect(decision).toMatchObject({ action: "close", closeReason: "target_hit", targetLabel: "T2" });
  });

  it("closes a buy on the stop when the low reaches it", () => {
    const decision = evaluateTipBar(buy, bar("2026-10-13", 100, 105, 89, 92));
    expect(decision.closeReason).toBe("stop_loss_hit");
  });

  it("counts the stop when both levels are the same distance from the open", () => {
    const decision = evaluateTipBar(buy, bar("2026-10-13", 100, 110, 90, 100));
    expect(decision.closeReason).toBe("stop_loss_hit");
    expect(decision.targetLabel).toBeNull();
  });

  it("counts the target when it is nearer the open than the stop", () => {
    const decision = evaluateTipBar(buy, bar("2026-10-13", 108, 112, 90, 100));
    expect(decision).toMatchObject({ closeReason: "target_hit", targetLabel: "T1" });
  });

  it("mirrors the rules for a sell", () => {
    const sell: EvalTip = { ...buy, side: "SELL", stopLoss: 120, targets: [{ label: "T1", price: 90 }] };
    expect(evaluateTipBar(sell, bar("2026-10-13", 100, 105, 89, 95)).closeReason).toBe("target_hit");
    expect(evaluateTipBar(sell, bar("2026-10-13", 100, 121, 95, 110)).closeReason).toBe("stop_loss_hit");
    expect(evaluateTipBar(sell, bar("2026-10-13", 105, 120, 90, 100)).closeReason).toBe("stop_loss_hit");
  });

  it("expires on the window date when nothing is touched, and still counts a hit that day", () => {
    expect(evaluateTipBar(buy, bar("2026-10-20", 100, 105, 95, 101)).action).toBe("expire");
    expect(evaluateTipBar(buy, bar("2026-10-20", 100, 121, 95, 118)).closeReason).toBe("target_hit");
    expect(evaluateTipBar(buy, bar("2026-10-21", 100, 105, 95, 101)).action).toBe("expire");
  });

  it("walks bars in order and ignores a bar from before publication", () => {
    const decision = evaluateTipSeries(
      buy,
      [bar("2026-10-01", 100, 130, 80, 100), bar("2026-10-14", 100, 105, 96, 101)],
      "2026-10-14",
    );
    expect(decision.action).toBe("hold");
    expect(evaluateTipSeries(buy, [], "2026-10-21").action).toBe("expire");
  });

  it("leaves drafts and broken bars alone", () => {
    expect(evaluateTipBar({ ...buy, status: "draft" }, bar("2026-10-13", 100, 130, 80, 100)).action).toBe("hold");
    expect(evaluateTipBar(buy, bar("2026-10-13", 100, 90, 110, 100)).action).toBe("hold");
  });

  it("uses a bhavcopy bar near the entry, and a last price only when it is near too", () => {
    const stored = barsForEvaluation({
      entry: 100,
      stored: [bar("2026-10-13", 10, 11, 9, 10), bar("2026-10-14", 101, 104, 99, 103)],
      last: 500,
      today: "2026-10-14",
    });
    expect(stored.source).toBe("bhavcopy");
    expect(stored.bars).toHaveLength(1);
    expect(barsForEvaluation({ entry: 100, stored: [], last: 102, today: "2026-10-14" }).source).toBe("last");
    expect(barsForEvaluation({ entry: 100, stored: [], last: 400, today: "2026-10-14" }).source).toBe("none");
  });

  it("writes a plain result note and respects alert choices", () => {
    const hit = evaluateTipBar(buy, bar("2026-10-13", 100, 121, 95, 118));
    expect(resultNote("RELIANCE", hit)?.title).toBe("RELIANCE reached T2");
    expect(wantsResultAlert({ targetHit: false, stopLoss: true, expired: false }, hit)).toBe(false);
    expect(wantsResultAlert({ targetHit: true, stopLoss: true, expired: false }, hit)).toBe(true);
    const expired = evaluateTipBar(buy, bar("2026-10-21", 100, 101, 99, 100));
    expect(wantsResultAlert({ targetHit: true, stopLoss: true, expired: false }, expired)).toBe(false);
  });

  it("reads the India date without shifting a plain day", () => {
    expect(istDay("2026-10-11")).toBe("2026-10-11");
    expect(istDay("2026-10-11T20:00:00.000Z")).toBe("2026-10-12");
  });
});

describe("recommended ideas", () => {
  it("puts featured names first, then saved symbols, then newer dates", () => {
    const ranked = rankRecommended(
      [
        { id: "a", symbol: "TCS", featured: false, publishedAt: "2026-10-12T00:00:00.000Z" },
        { id: "b", symbol: "INFY", featured: true, publishedAt: "2026-10-01T00:00:00.000Z" },
        { id: "c", symbol: "SBIN", featured: false, publishedAt: "2026-10-11T00:00:00.000Z" },
      ],
      ["SBIN"],
      2,
    );
    expect(ranked.map((tip) => tip.id)).toEqual(["b", "c"]);
  });
});

describe("bhavcopy screener", () => {
  it("scores a rising breakout above a falling series", () => {
    const rising = dayBars(100, 0.45, 60, 1000);
    const last = rising[rising.length - 1];
    if (!last) throw new Error("missing bar");
    last.close = last.high + 2;
    last.high = last.close;
    last.volume = 4000;
    const up = scoreHighConfidence(rising);
    const down = scoreHighConfidence(dayBars(200, -0.45, 60, 1000));
    expect(up?.trend).toBe("up");
    expect(up?.reasons.some((reason) => reason.includes("20-session high"))).toBe(true);
    expect((up?.score ?? 0) > (down?.score ?? 100)).toBe(true);
    expect(rankHighConfidence({ DOWN: dayBars(200, -0.45, 60, 1000), UP: rising }).map((row) => row.symbol)[0]).toBe("UP");
  });

  it("needs fifty sessions", () => {
    expect(scoreHighConfidence(dayBars(100, 0.2, 20, 1000))).toBeNull();
  });
});

describe("pulse boards, levels, and open interest", () => {
  it("keeps a tight range on the option-selling board", () => {
    const flat = Array.from({ length: 55 }, (_, index) => candle(100, index));
    const boards = buildPulseBoards([{ symbol: "FLAT", candles: flat }]);
    expect(boards.optionSelling[0]?.symbol).toBe("FLAT");
    expect(boards.optionSelling[0]?.fit).toBe("closer");
    expect(boards.sideways.some((row) => row.symbol === "FLAT")).toBe(true);
  });

  it("finds a swing high above price and a swing low below it", () => {
    const bars = [10, 11, 14, 12, 9, 8, 7, 9, 10, 11, 10].map((close) => ({
      high: close + 0.4,
      low: close - 0.4,
      close,
    }));
    const levels = supportResistance(bars, 2);
    expect(levels?.resistances.length).toBeGreaterThan(0);
    expect(levels?.supports.length).toBeGreaterThan(0);
    expect(levels?.resistances.every((level) => level.price > (levels?.price ?? 0))).toBe(true);
    expect(levels?.supports.every((level) => level.price < (levels?.price ?? 0))).toBe(true);
  });

  it("computes PCR, max pain, and one option-buying sketch", () => {
    const summary = summarizeChain([
      { underlying: "NIFTY", tradeDate: "2026-10-13", expiry: "2026-10-16", strike: 100, optionType: "CE", openInterest: 20, oiChange: 0, ltp: 4, iv: 12, volume: 10 },
      { underlying: "NIFTY", tradeDate: "2026-10-13", expiry: "2026-10-16", strike: 110, optionType: "CE", openInterest: 0, oiChange: 0, ltp: 1, iv: 12, volume: 1 },
      { underlying: "NIFTY", tradeDate: "2026-10-13", expiry: "2026-10-16", strike: 100, optionType: "PE", openInterest: 40, oiChange: 0, ltp: 3, iv: 12, volume: 8 },
    ]);
    expect(summary.pcr).toBe(2);
    expect(summary.bias).toBe("bullish");
    expect(painStrike(summary.callOi === 20 ? [
      { underlying: "NIFTY", tradeDate: "2026-10-13", expiry: "2026-10-16", strike: 100, optionType: "CE", openInterest: 20, oiChange: 0, ltp: 4, iv: 12, volume: 10 },
      { underlying: "NIFTY", tradeDate: "2026-10-13", expiry: "2026-10-16", strike: 110, optionType: "CE", openInterest: 0, oiChange: 0, ltp: 1, iv: 12, volume: 0 },
    ] : [])).toBe(100);
    const idea = optionBuyingIdeas(100, [
      { underlying: "NIFTY", tradeDate: "2026-10-13", expiry: "2026-10-16", strike: 100, optionType: "CE", openInterest: 20, oiChange: 0, ltp: 4, iv: 12, volume: 10 },
      { underlying: "NIFTY", tradeDate: "2026-10-13", expiry: "2026-10-16", strike: 110, optionType: "CE", openInterest: 10, oiChange: 0, ltp: 2, iv: 12, volume: 4 },
    ], "bullish");
    expect(idea[0]).toMatchObject({ optionType: "CE", strike: 100, premium: 4, stopPremium: 2.8, targetPremium: 6 });
    expect(sampleChain("NIFTY", 25000, "2026-10-13").length).toBeGreaterThan(10);
  });
});

describe("tip check, files, and the settings comparison", () => {
  it("waits when the checks cancel out and allows the free quota until it is used", () => {
    const flat = Array.from({ length: 40 }, (_, index) => candle(100, index));
    expect(checkSymbol(flat)?.side).toBe("WAIT");
    const rising = Array.from({ length: 55 }, (_, index) => candle(80 + index, index));
    expect(checkSymbol(rising)?.side).toBe("BUY");
    expect(quotaAllows(7, "free")).toBe(true);
    expect(quotaAllows(8, "free")).toBe(false);
    expect(quotaAllows(8, "premium")).toBe(true);
  });

  it("reads equity and option end-of-day files", () => {
    expect(parseTradeDay("13-OCT-2026")).toBe("2026-10-13");
    const bars = parseBhavcopyCsv(
      "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\nRELIANCE,EQ,2900,2950,2890,2940,1000,13-OCT-2026\nRELIANCE,BE,1,1,1,1,1,13-OCT-2026\nSKIP,XX,1,2,1,1,1,13-OCT-2026\n",
    );
    expect(bars).toHaveLength(2);
    expect(bars[0]?.symbol).toBe("RELIANCE");
    const oi = parseOiCsv(
      "SYMBOL,EXPIRY_DT,STRIKE_PR,OPTION_TYP,CLOSE,OPEN_INT,CHG_IN_OI,CONTRACTS,TIMESTAMP\nNIFTY,30-Oct-2026,25000,CE,120,5000,100,80,13-OCT-2026\nNIFTY,30-Oct-2026,0,XX,1,1,0,1,13-OCT-2026\n",
    );
    expect(oi).toEqual([
      expect.objectContaining({ underlying: "NIFTY", optionType: "CE", strike: 25000, expiry: "2026-10-30", tradeDate: "2026-10-13" }),
    ]);
    expect(parseBhavcopyCsv("")).toEqual([]);
  });

  it("highlights an EMA length only when enough trades have both wins and losses", () => {
    const quiet = Array.from({ length: 30 }, (_, index) => candle(50, index));
    expect(optimizeEmaPeriods(quiet, { periods: [8, 12], minTrades: 2 }).pickedPeriod).toBeNull();
    const wavy: Candle[] = [];
    for (let index = 0; index < 40; index += 1) {
      const close = index % 8 < 4 ? 100 + (index % 4) * 3 : 112 - (index % 4) * 3;
      wavy.push(candle(close, index));
    }
    const result = optimizeEmaPeriods(wavy, { periods: [4, 8], feeBps: 0, slippageBps: 0, minTrades: 1 });
    expect(result.rows).toHaveLength(2);
    expect(result.rows.every((row) => row.emaPeriod === 4 || row.emaPeriod === 8)).toBe(true);
    expect(result.note.length).toBeGreaterThan(10);
  });
});
