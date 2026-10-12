import features from "../../../../../config/features.json";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { apiOk, withApi } from "@/server/http";
import { FORMULA_VERSIONS, centralPivotRange, exponentialMovingAverage, lastNumber, wilderRsi } from "@/server/indicators/formulas";
import { pulseScore } from "@/server/indicators/pulse";
import { sampleCandleEnd, sampleCandles } from "@/server/market-data/candles";
import { loadInstruments } from "@/server/market-data/catalog";
import { isInstrumentActive } from "@/server/market-data/instruments";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/pulse", async ({ requestId }) => {
    await requireActor(request);
    const symbol = new URL(request.url).searchParams.get("symbol")?.trim().toUpperCase() ?? "";
    if (!/^[A-Z][A-Z0-9&-]{0,20}$/.test(symbol)) {
      throw new AppError(400, "VALIDATION_ERROR", "Choose a symbol.", { symbol: "Enter a symbol." });
    }
    const now = new Date();
    const instruments = await loadInstruments();
    const instrument = instruments.find((item) => item.symbol === symbol);
    if (!instrument || !isInstrumentActive(instrument, now)) {
      throw new AppError(404, "NOT_FOUND", "That symbol is not in the active sample universe.");
    }
    const candles = sampleCandles(symbol, 40, sampleCandleEnd(now)).filter((candle) => candle.complete && Date.parse(candle.closeTime) <= now.getTime());
    const closes = candles.map((candle) => candle.close);
    const last = candles[candles.length - 1];
    const previous = candles.length >= 2 ? candles[candles.length - 2] : null;
    const rsi = lastNumber(wilderRsi(closes, features.indicatorDefaults.rsiPeriod));
    const ema = lastNumber(exponentialMovingAverage(closes, features.indicatorDefaults.emaPeriod));
    const cpr = previous ? centralPivotRange(previous) : null;
    const score = pulseScore({
      rsi,
      close: last?.close ?? null,
      ema,
      cprTop: cpr?.top ?? null,
      cprBottom: cpr?.bottom ?? null,
    });
    return apiOk(
      {
        symbol,
        dataLabel: "Sample data",
        live: false,
        notice: "Pulse uses the sample candle set. It is not a live score and it is not a recommendation.",
        formulaVersions: {
          rsi: FORMULA_VERSIONS.rsi,
          ema: FORMULA_VERSIONS.ema,
          cpr: FORMULA_VERSIONS.cpr,
        },
        candleCloseTime: last?.closeTime ?? null,
        pulse: score,
      },
      requestId,
    );
  });
}
