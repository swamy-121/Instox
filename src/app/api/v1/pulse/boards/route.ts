import { requireActor } from "@/server/auth/actor";
import { apiOk, withApi } from "@/server/http";
import { loadInstruments } from "@/server/market-data/catalog";
import { isInstrumentActive } from "@/server/market-data/instruments";
import { buildPulseBoards } from "@/server/research/boards";
import { loadResearchSeries } from "@/server/research/sources";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/pulse/boards", async ({ requestId }) => {
    await requireActor(request);
    const now = new Date();
    const instruments = (await loadInstruments()).filter((item) => isInstrumentActive(item, now));
    const series = await loadResearchSeries(instruments.map((item) => item.symbol), now);
    const boards = buildPulseBoards(instruments.map((item) => ({ symbol: item.symbol, candles: series.candles[item.symbol] ?? [] })));
    return apiOk({
      source: series.source,
      dataLabel: series.source === "sample" ? "Sample data" : "End-of-day file",
      notice: series.notice,
      ...boards,
      sellingNote: "A short option can lose more than the credit. Read the strikes as a map of the range, not a trade to place.",
      sidewaysNote: "A quiet stretch can end without warning. These names are inside a band on the prices we have.",
    }, requestId);
  });
}
