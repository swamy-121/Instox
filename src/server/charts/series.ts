import { exponentialMovingAverage, type Candle } from "@/server/indicators/formulas";
import { sampleCandleEnd, sampleCandles } from "@/server/market-data/candles";

export type ChartSeries = {
  symbol: string;
  interval: "1d";
  dataLabel: "Sample data";
  live: false;
  notice: string;
  candles: Array<Pick<Candle, "openTime" | "closeTime" | "open" | "high" | "low" | "close"> & { ema: number | null }>;
};

export function buildChartSeries(symbol: string, bars = 40, emaPeriod = 20, now = new Date()): ChartSeries {
  const count = Math.min(80, Math.max(10, bars));
  const candles = sampleCandles(symbol, count, sampleCandleEnd(now));
  const ema = exponentialMovingAverage(candles.map((candle) => candle.close), emaPeriod);
  return {
    symbol,
    interval: "1d",
    dataLabel: "Sample data",
    live: false,
    notice: "Candles and the EMA overlay are sample data. They are not a live chart.",
    candles: candles.map((candle, index) => ({
      openTime: candle.openTime,
      closeTime: candle.closeTime,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      ema: ema[index],
    })),
  };
}
