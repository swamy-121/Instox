import { requireActor } from "@/server/auth/actor";
import { apiOk, withApi } from "@/server/http";
import { loadInstruments } from "@/server/market-data/catalog";
import { isInstrumentActive } from "@/server/market-data/instruments";
import { rankHighConfidence } from "@/server/research/confidence";
import { loadResearchSeries } from "@/server/research/sources";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/screener/bhavcopy", async ({ requestId }) => {
    await requireActor(request);
    const now = new Date();
    const instruments = (await loadInstruments()).filter((item) => isInstrumentActive(item, now) && item.segment === "equity");
    const series = await loadResearchSeries(instruments.map((item) => item.symbol), now);
    const rows = rankHighConfidence(series.bars);
    return apiOk({
      source: series.source,
      dataLabel: series.source === "sample" ? "Sample data" : "End-of-day file",
      notice: series.notice,
      rows,
      standout: rows.filter((row) => row.band === "stands out").length,
    }, requestId);
  });
}
