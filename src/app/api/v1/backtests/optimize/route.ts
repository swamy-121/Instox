import { z } from "zod";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { requireActor } from "@/server/auth/actor";
import { optimizeEmaPeriods } from "@/server/backtest/optimize";
import { getDb } from "@/server/db/client";
import { backtests } from "@/server/db/schema";
import { apiOk, readJson, withApi } from "@/server/http";
import { sampleCandleEnd, sampleCandles } from "@/server/market-data/candles";
import { loadInstruments } from "@/server/market-data/catalog";
import { isInstrumentActive } from "@/server/market-data/instruments";

const bodySchema = z.object({ symbol: z.string().trim().min(1).max(21) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/backtests/optimize", async ({ requestId }) => {
    const actor = await requireActor(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Choose a symbol.", { symbol: "Enter a symbol." });
    const symbol = parsed.data.symbol.toUpperCase();
    const now = new Date();
    const instruments = await loadInstruments();
    const instrument = instruments.find((item) => item.symbol === symbol);
    if (!instrument || !isInstrumentActive(instrument, now)) {
      throw new AppError(404, "NOT_FOUND", "That symbol is not in the active sample universe.");
    }
    const candles = sampleCandles(symbol, 80, sampleCandleEnd(now)).filter((candle) => Date.parse(candle.closeTime) <= now.getTime());
    const result = optimizeEmaPeriods(candles);
    const id = createId("opt");
    await getDb().insert(backtests).values({
      id,
      userId: actor.uid,
      symbol,
      result: { kind: "ema-grid", ...result } as unknown as Record<string, unknown>,
      createdAt: now.toISOString(),
    });
    return apiOk({
      id,
      symbol,
      hypothetical: true,
      label: "Hypothetical",
      dataLabel: "Sample data",
      live: false,
      ...result,
    }, requestId);
  });
}
