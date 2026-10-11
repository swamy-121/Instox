import type { Candle } from "@/server/indicators/formulas";

/** Keep the sample series completed relative to "now" without pretending it is a live feed. */
export function sampleCandleEnd(now = new Date()): Date {
  const fixed = Date.parse("2026-10-11T10:00:00.000Z");
  return new Date(Math.min(now.getTime(), fixed));
}

/** Deterministic sample candles. These are not market prices. */
export function sampleCandles(symbol: string, count = 40, end = sampleCandleEnd()): Candle[] {
  const seed = Array.from(symbol).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const candles: Candle[] = [];
  let price = 100 + (seed % 50);
  for (let index = count - 1; index >= 0; index -= 1) {
    const wave = Math.sin((seed + index) / 3) * 2;
    const open = price;
    const close = Math.round((price + wave) * 20) / 20;
    const high = Math.max(open, close) + 0.5;
    const low = Math.min(open, close) - 0.5;
    const closeTime = new Date(end.getTime() - index * 24 * 60 * 60 * 1000);
    const openTime = new Date(closeTime.getTime() - 24 * 60 * 60 * 1000);
    candles.push({
      open,
      high,
      low,
      close,
      openTime: openTime.toISOString(),
      closeTime: closeTime.toISOString(),
      sourceTimestamp: closeTime.toISOString(),
      freshnessStatus: "sample",
      qualityFlags: ["sample"],
      complete: true,
    });
    price = close;
  }
  return candles;
}

export function assertOhlc(candle: { open: number; high: number; low: number; close: number }): boolean {
  return (
    [candle.open, candle.high, candle.low, candle.close].every((value) => Number.isFinite(value) && value > 0) &&
    candle.high >= candle.low &&
    candle.high >= candle.open &&
    candle.high >= candle.close &&
    candle.low <= candle.open &&
    candle.low <= candle.close
  );
}
