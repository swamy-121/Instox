import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { apiOk, withApi } from "@/server/http";
import { loadInstruments } from "@/server/market-data/catalog";
import { isInstrumentActive } from "@/server/market-data/instruments";
import { supportResistance } from "@/server/research/levels";
import { loadResearchSeries } from "@/server/research/sources";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/levels", async ({ requestId }) => {
    await requireActor(request);
    const symbol = new URL(request.url).searchParams.get("symbol")?.trim().toUpperCase() || "RELIANCE";
    if (!/^[A-Z][A-Z0-9&-]{0,20}$/.test(symbol)) {
      throw new AppError(400, "VALIDATION_ERROR", "Use a symbol like RELIANCE.", { symbol: "Enter a symbol." });
    }
    const now = new Date();
    const instruments = await loadInstruments();
    const instrument = instruments.find((item) => item.symbol === symbol);
    if (!instrument || !isInstrumentActive(instrument, now)) {
      throw new AppError(404, "NOT_FOUND", "That symbol is not in the active list.");
    }
    const series = await loadResearchSeries([symbol], now);
    const candles = series.candles[symbol] ?? [];
    const levels = supportResistance(candles.map((candle) => ({ high: candle.high, low: candle.low, close: candle.close })));
    if (!levels) throw new AppError(422, "BUSINESS_RULE_FAILED", "There are not enough bars to mark levels yet.");
    return apiOk({
      symbol,
      source: series.source,
      dataLabel: series.source === "sample" ? "Sample data" : "End-of-day file",
      notice: series.notice,
      ...levels,
    }, requestId);
  });
}
