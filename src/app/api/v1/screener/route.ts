import features from "../../../../../config/features.json";
import { requireActor } from "@/server/auth/actor";
import { apiOk, withApi } from "@/server/http";
import type { Candle } from "@/server/indicators/formulas";
import { loadRuntimeFlags } from "@/server/indicators/runtime";
import { adminDb } from "@/server/db/admin";
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
    const stored = await adminDb().collection("candleSeries").limit(100).get();
    const candlesBySymbol: Record<string, Candle[]> = {};
    for (const doc of stored.docs) {
      const candles = doc.data().candles;
      if (Array.isArray(candles)) candlesBySymbol[doc.id] = candles;
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
        notice: "These rows use the candle series stored for each symbol. They are not a live scan.",
        ...screen,
      },
      requestId,
    );
  });
}
