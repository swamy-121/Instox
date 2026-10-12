import { describe, expect, it } from "vitest";
import {
  centralPivotRange,
  exponentialMovingAverage,
  superTrend,
  wilderAtr,
  wilderRsi,
} from "@/server/indicators/formulas";

describe("indicator formulas", () => {
  it("computes Wilder RSI, including flat and all-up series", () => {
    const series = wilderRsi([10, 11, 12, 11, 13], 3);
    expect(series.slice(0, 3)).toEqual([null, null, null]);
    expect(series[3]).toBeCloseTo(66.666666, 4);
    expect(series[4]).toBeCloseTo(83.333333, 4);
    expect(wilderRsi([5, 5, 5, 5], 3)[3]).toBe(50);
    expect(wilderRsi([1, 2, 3, 4], 3)[3]).toBe(100);
  });

  it("seeds EMA with the SMA, then applies alpha 2/(period+1)", () => {
    const series = exponentialMovingAverage([10, 12, 14, 16], 3);
    expect(series[0]).toBeNull();
    expect(series[1]).toBeNull();
    expect(series[2]).toBe(12);
    expect(series[3]).toBe(14);
  });

  it("builds CPR top and bottom from TC and BC", () => {
    const cpr = centralPivotRange({ high: 105, low: 95, close: 102 });
    expect(cpr.pivot).toBeCloseTo(302 / 3, 6);
    expect(cpr.bc).toBe(100);
    expect(cpr.tc).toBeCloseTo(2 * (302 / 3) - 100, 6);
    expect(cpr.top).toBe(Math.max(cpr.tc, cpr.bc));
    expect(cpr.bottom).toBe(Math.min(cpr.tc, cpr.bc));
  });

  it("seeds Wilder ATR with the simple average of the first true ranges", () => {
    const series = wilderAtr(
      [
        { high: 10, low: 8, close: 9 },
        { high: 12, low: 9, close: 11 },
        { high: 11, low: 10, close: 10.5 },
        { high: 14, low: 11, close: 13 },
      ],
      3,
    );
    expect(series[2]).toBeCloseTo(2, 6);
    expect(series[3]).toBeCloseTo(2.5, 6);
  });

  it("flips SuperTrend only on a strict cross of the previous final band", () => {
    const points = superTrend(
      [
        { high: 10, low: 8, close: 9 },
        { high: 12, low: 10, close: 11 },
        { high: 9, low: 7, close: 7.5 },
      ],
      1,
      1,
    );
    expect(points[0]).toMatchObject({ trend: "up", value: 7, finalUpper: 11, finalLower: 7 });
    expect(points[1]).toMatchObject({ trend: "up", value: 8, finalUpper: 11, finalLower: 8 });
    expect(points[2]).toMatchObject({ trend: "down", value: 11, finalUpper: 11, finalLower: 8 });
  });
});
