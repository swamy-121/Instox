import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { apiOk, withApi } from "@/server/http";
import { buildChartSeries } from "@/server/charts/series";
import { loadInstruments } from "@/server/market-data/catalog";
import { isInstrumentActive } from "@/server/market-data/instruments";

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> },
): Promise<Response> {
  return withApi(request, "GET /api/v1/charts/:symbol", async ({ requestId }) => {
    await requireActor(request);
    const { symbol: raw } = await context.params;
    const symbol = raw.toUpperCase();
    const now = new Date();
    const instruments = await loadInstruments();
    const instrument = instruments.find((item) => item.symbol === symbol);
    if (!instrument || !isInstrumentActive(instrument, now)) {
      throw new AppError(404, "NOT_FOUND", "That symbol is not in the active sample universe.");
    }
    const bars = Number(new URL(request.url).searchParams.get("bars") ?? "40");
    if (!Number.isInteger(bars) || bars < 10 || bars > 80) {
      throw new AppError(400, "VALIDATION_ERROR", "Choose between 10 and 80 bars.", { bars: "Use 10 to 80." });
    }
    return apiOk(buildChartSeries(symbol, bars, 20, now), requestId);
  });
}
