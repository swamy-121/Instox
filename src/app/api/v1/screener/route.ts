import features from "../../../../../config/features.json";
import { requireActor } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { candleSeries } from "@/server/db/schema";
import { readSetting } from "@/server/db/settings";
import { apiOk, withApi } from "@/server/http";
import type { Candle } from "@/server/indicators/formulas";
import { loadRuntimeFlags } from "@/server/indicators/runtime";
import { loadInstruments } from "@/server/market-data/catalog";
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
    const preset = (await readSetting("screenerPresets")) ?? {};
    const rsiPeriod = periodParam(url.searchParams, "rsiPeriod", preset.rsiPeriod, features.indicatorDefaults.rsiPeriod);
    const emaPeriod = periodParam(url.searchParams, "emaPeriod", preset.emaPeriod, features.indicatorDefaults.emaPeriod);
    const stored = await getDb().select().from(candleSeries).limit(100);
    const candlesBySymbol: Record<string, Candle[]> = {};
    for (const row of stored) {
      if (Array.isArray(row.candles)) candlesBySymbol[row.symbol] = row.candles as Candle[];
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
    return apiOk({
      dataLabel: "Sample data",
      live: false,
      notice: "These rows use the candle series stored for each symbol. They are not a live scan.",
      ...screen,
    }, requestId);
  });
}
