import features from "../../../../../config/features.json";
import { requireActor } from "@/server/auth/actor";
import { apiOk, withApi } from "@/server/http";
import type { Candle } from "@/server/indicators/formulas";
import { loadRuntimeFlags } from "@/server/indicators/runtime";
import { adminDb } from "@/server/db/admin";
import { loadInstruments } from "@/server/market-data/catalog";
import { loadFeedQuotes } from "@/server/market-data/hub";
import { activeFeedId, overlayQuote, type Freshness } from "@/server/market-data/quotes";
import { runScreener } from "@/server/screener/engine";
import { filtersFromSearchParams } from "@/server/screener/query";

function periodParam(params: URLSearchParams, key: string, stored: unknown, fallback: number): number {
  const raw = params.get(key);
  const value = raw === null || raw.trim() === "" ? Number(stored) : Number(raw);
  if (!Number.isInteger(value) || value < 2 || value > 200) return fallback;
  return value;
}

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/screener", async ({ requestId }) => {
    await requireActor(request);
    const url = new URL(request.url);
    const filters = filtersFromSearchParams(url.searchParams);
    const now = new Date();
    const instruments = await loadInstruments();
    const flags = await loadRuntimeFlags();
    const presetSnap = await adminDb().collection("appConfig").doc("screenerPresets").get();
    const preset = presetSnap.exists ? presetSnap.data() ?? {} : {};
    const rsiPeriod = periodParam(url.searchParams, "rsiPeriod", preset.rsiPeriod, features.indicatorDefaults.rsiPeriod);
    const emaPeriod = periodParam(url.searchParams, "emaPeriod", preset.emaPeriod, features.indicatorDefaults.emaPeriod);
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
        rsi: rsiPeriod,
        ema: emaPeriod,
        atr: features.indicatorDefaults.atrPeriod,
        supertrend: features.indicatorDefaults.supertrendPeriod,
        supertrendMultiplier: features.indicatorDefaults.supertrendMultiplier,
      },
    });
    const feed = activeFeedId();
    let results = screen.results.map((row) => ({ ...row, freshnessStatus: "stored" as Freshness }));
    if (feed !== "mock") {
      const quotes = await loadFeedQuotes(results.map((row) => row.symbol));
      results = results.map((row) => overlayQuote(row, quotes.get(row.symbol) ?? null, feed, now.getTime()));
    }
    const live = results.some((row) => row.freshnessStatus === "live");
    return apiOk(
      {
        dataLabel: live ? "Live" : "Sample data",
        live,
        feed,
        notice: live
          ? "Last prices follow the market feed. Indicator values still use stored candles."
          : "These rows use the candle series stored for each symbol. They are not a live scan.",
        ...screen,
        results,
      },
      requestId,
    );
  });
}
