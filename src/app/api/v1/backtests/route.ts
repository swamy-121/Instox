import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { apiOk, readJson, withApi } from "@/server/http";
import { runSampleBacktest } from "@/server/backtest/run";
import { sampleCandleEnd, sampleCandles } from "@/server/market-data/candles";
import { loadInstruments } from "@/server/market-data/catalog";
import { isInstrumentActive } from "@/server/market-data/instruments";

const bodySchema = z.object({ symbol: z.string().min(1).max(21) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/backtests", async ({ requestId }) => {
    await requireActor(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Choose a symbol.", { symbol: "Enter a symbol." });
    }
    const symbol = parsed.data.symbol.trim().toUpperCase();
    const now = new Date();
    const instruments = await loadInstruments();
    const instrument = instruments.find((item) => item.symbol === symbol);
    if (!instrument || !isInstrumentActive(instrument, now)) {
      throw new AppError(404, "NOT_FOUND", "That symbol is not in the active sample universe.");
    }
    const candles = sampleCandles(symbol, 40, sampleCandleEnd(now)).filter((candle) => Date.parse(candle.closeTime) <= now.getTime());
    const result = runSampleBacktest(candles);
    return apiOk({ symbol, ...result }, requestId);
  });
}
