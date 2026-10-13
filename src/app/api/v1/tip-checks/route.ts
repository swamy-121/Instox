import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { viewerTier } from "@/server/authorization/entitlements";
import { apiOk, readJson, withApi } from "@/server/http";
import { TIP_CHECK_LIMITS, checkSymbol, quotaAllows } from "@/server/research/check";
import { loadResearchSeries } from "@/server/research/sources";
import { loadInstruments } from "@/server/market-data/catalog";
import { isInstrumentActive } from "@/server/market-data/instruments";
import { checksUsedToday, recordTipCheck } from "@/server/tips/library";

const bodySchema = z.object({ symbol: z.string().trim().min(1).max(21) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/tip-checks", async ({ requestId }) => {
    const actor = await requireActor(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Choose a symbol.", { symbol: "Enter a symbol." });
    const symbol = parsed.data.symbol.toUpperCase();
    const tier = viewerTier(actor.entitlement);
    const used = await checksUsedToday(actor.uid);
    if (!quotaAllows(used, tier)) {
      throw new AppError(429, "RATE_LIMITED", "You have used today's checks. They reset tomorrow morning.");
    }
    const now = new Date();
    const instruments = await loadInstruments();
    const instrument = instruments.find((item) => item.symbol === symbol);
    if (!instrument || !isInstrumentActive(instrument, now)) {
      throw new AppError(404, "NOT_FOUND", "That symbol is not in the active list.");
    }
    const series = await loadResearchSeries([symbol], now);
    const reading = checkSymbol(series.candles[symbol] ?? []);
    if (!reading) throw new AppError(422, "BUSINESS_RULE_FAILED", "There are not enough bars to check this symbol yet.");
    await recordTipCheck({
      userId: actor.uid,
      symbol,
      side: reading.side,
      agreement: reading.agreement,
      summary: reading.reasons.join(" "),
      source: series.source,
    });
    const limit = TIP_CHECK_LIMITS[tier];
    return apiOk({
      symbol,
      ...reading,
      source: series.source,
      dataLabel: series.source === "sample" ? "Sample data" : "End-of-day file",
      notice: series.notice,
      used: used + 1,
      limit,
      remaining: Math.max(0, limit - used - 1),
    }, requestId);
  });
}
