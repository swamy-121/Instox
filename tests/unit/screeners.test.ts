import { describe, expect, it } from "vitest";
import { buildPulseBoards } from "@/server/research/boards";
import { rankHighConfidence, scoreHighConfidence } from "@/server/research/confidence";
import { supportResistance } from "@/server/research/levels";
import { parseBhavcopyCsv, type BhavBar } from "@/server/research/parsers";
import type { Candle } from "@/server/indicators/formulas";

function dayBars(start: number, step: number, count: number, volume: number): BhavBar[] {
  return Array.from({ length: count }, (_, index) => {
    const close = start + index * step;
    const date = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
    return {
      symbol: "DEMO",
      tradeDate: date,
      open: close - step * 0.2,
      high: close + Math.abs(step) * 0.3,
      low: close - Math.abs(step) * 0.4,
      close,
      volume,
    };
  });
}

function flatCandle(index: number): Candle {
  const closeTime = new Date(Date.UTC(2026, 0, 1 + index, 10)).toISOString();
  return {
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    openTime: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    closeTime,
    sourceTimestamp: closeTime,
    freshnessStatus: "sample",
    qualityFlags: ["sample"],
    complete: true,
  };
}

describe("screener calculations", () => {
  it("gives a rising breakout a higher score than a falling series", () => {
    const rising = dayBars(100, 0.45, 60, 1000);
    const last = rising[rising.length - 1];
    if (!last) throw new Error("missing bar");
    last.close = last.high + 2;
    last.high = last.close;
    last.volume = 4000;
    const up = scoreHighConfidence(rising);
    const down = scoreHighConfidence(dayBars(200, -0.45, 60, 1000));
    expect(up?.band === "stands out" || (up?.score ?? 0) >= 55).toBe(true);
    expect((up?.score ?? 0) > (down?.score ?? 0)).toBe(true);
    expect(rankHighConfidence({ FALL: dayBars(200, -0.2, 55, 1000), RISE: rising })[0]?.symbol).toBe("RISE");
  });

  it("keeps a flat series on the option-selling and sideways boards", () => {
    const boards = buildPulseBoards([{ symbol: "FLAT", candles: Array.from({ length: 55 }, (_, index) => flatCandle(index)) }]);
    expect(boards.optionSelling[0]).toMatchObject({ symbol: "FLAT", fit: "closer" });
    expect(boards.sideways[0]?.fit).toBe("closer");
    expect(boards.optionSelling[0]?.callStrike).toBeGreaterThan(boards.optionSelling[0]?.putStrike ?? 0);
  });

  it("reads an equity bhavcopy row and skips a non-equity series", () => {
    const rows = parseBhavcopyCsv("SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\nINFY,EQ,1800,1820,1790,1810,2500,13-OCT-2026\nINFY,XX,1,1,1,1,1,13-OCT-2026\n");
    expect(rows).toEqual([
      expect.objectContaining({ symbol: "INFY", tradeDate: "2026-10-13", close: 1810, volume: 2500 }),
    ]);
  });

  it("places swing levels on the correct side of the last close", () => {
    const bars = [10, 12, 15, 13, 11, 8, 7, 9, 10, 12, 11].map((close) => ({ high: close + 0.2, low: close - 0.2, close }));
    const levels = supportResistance(bars, 2);
    expect(levels).not.toBeNull();
    expect(levels?.supports.every((level) => level.price < (levels?.price ?? 0))).toBe(true);
    expect(levels?.resistances.every((level) => level.price > (levels?.price ?? 0))).toBe(true);
  });
});
