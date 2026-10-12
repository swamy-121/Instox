import { describe, expect, it } from "vitest";
import { applyCosts, walkEmaCross } from "@/server/backtest/run";
import { buildChartSeries } from "@/server/charts/series";
import type { Candle } from "@/server/indicators/formulas";
import { decideShopOrder } from "@/server/shop/catalog";
import { assertStrategyDoesNotPublish, nextStrategyVersion, validateStrategy } from "@/server/strategies/model";
import { AppError } from "@/lib/errors";

function candle(close: number, closeTime: string): Candle {
  return {
    open: close,
    high: close + 0.5,
    low: close - 0.5,
    close,
    openTime: closeTime,
    closeTime,
    sourceTimestamp: closeTime,
    freshnessStatus: "sample",
    qualityFlags: ["sample"],
    complete: true,
  };
}

describe("shop, strategies, charts, and backtests", () => {
  it("holds an unapproved catalogue product and does not grant premium", () => {
    const decision = decideShopOrder("research_journal");
    expect(decision.amountMinor).toBe(49900);
    expect(decision.currency).toBe("INR");
    expect(decision.status).toBe("held_unapproved");
    expect(decision.grantsEntitlement).toBe(false);
    expect(decision.fulfillment).toBe("unconfigured");
  });

  it("keeps strategies in draft and refuses publish", () => {
    expect(() => assertStrategyDoesNotPublish({ publish: true })).toThrow(AppError);
    expect(() => assertStrategyDoesNotPublish({ status: "published" })).toThrow(AppError);
    const draft = validateStrategy({ name: "RSI dip", rules: [{ indicator: "rsi", operator: "lt", value: 30 }] }, 2);
    expect(draft).toMatchObject({ status: "draft", version: 2 });
    expect(nextStrategyVersion(2)).toBe(3);
  });

  it("labels chart series as sample data", () => {
    const series = buildChartSeries("RELIANCE", 20, 5, new Date("2026-10-11T12:00:00.000Z"));
    expect(series.live).toBe(false);
    expect(series.dataLabel).toBe("Sample data");
    expect(series.candles.length).toBe(20);
    expect(series.candles.some((candle) => candle.ema !== null)).toBe(true);
  });

  it("keeps losing trades and applies fees and slippage", () => {
    const flatLoss = applyCosts(100, 90, 0, 0);
    expect(flatLoss.outcome).toBe("loss");
    expect(flatLoss.netReturnPct).toBe(-10);
    const costly = applyCosts(100, 110, 10, 5);
    expect(costly.netReturnPct).toBeLessThan(costly.grossReturnPct);
    const trades = walkEmaCross(
      [
        candle(10, "2026-10-01T10:00:00.000Z"),
        candle(10, "2026-10-02T10:00:00.000Z"),
        candle(12, "2026-10-03T10:00:00.000Z"),
        candle(9, "2026-10-04T10:00:00.000Z"),
      ],
      2,
      0,
      0,
    );
    expect(trades.some((trade) => trade.outcome === "loss")).toBe(true);
    expect(trades[0].entryPrice).toBe(12);
    expect(trades[0].exitPrice).toBe(9);
  });
});
