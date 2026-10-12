import features from "../../../../../config/features.json";
import { requireActor } from "@/server/auth/actor";
import { apiOk, withApi } from "@/server/http";
import { loadRuntimeFlags } from "@/server/indicators/runtime";
import { sampleCandleEnd, sampleCandles } from "@/server/market-data/candles";
import { loadInstruments } from "@/server/market-data/catalog";
import { runScreener } from "@/server/screener/engine";
import { filtersFromSearchParams } from "@/server/screener/query";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/screener", async ({ requestId }) => {
    await requireActor(request);
    const url = new URL(request.url);
    const filters = filtersFromSearchParams(url.searchParams);
    const now = new Date();
    const instruments = await loadInstruments();
    const flags = await loadRuntimeFlags();
    const end = sampleCandleEnd(now);
    const candlesBySymbol: Record<string, ReturnType<typeof sampleCandles>> = {};
    for (const instrument of instruments) {
      candlesBySymbol[instrument.symbol] = sampleCandles(instrument.symbol, 40, end);
    }
    const screen = runScreener({
      instruments,
      candlesBySymbol,
      filters,
      flags,
      now,
      maxAgeMs: features.screener.maxAgeMs,
      periods: {
        rsi: features.indicatorDefaults.rsiPeriod,
        ema: features.indicatorDefaults.emaPeriod,
        atr: features.indicatorDefaults.atrPeriod,
        supertrend: features.indicatorDefaults.supertrendPeriod,
        supertrendMultiplier: features.indicatorDefaults.supertrendMultiplier,
      },
    });
    return apiOk(
      {
        dataLabel: "Sample data",
        live: false,
        notice: "These rows use the sample candle set. They are not a live scan.",
        ...screen,
      },
      requestId,
    );
  });
}
