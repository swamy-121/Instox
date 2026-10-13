import { createId } from "@/lib/ids";
import { requireOperations } from "@/server/auth/operations";
import { getDb } from "@/server/db/client";
import { jobRuns } from "@/server/db/schema";
import { apiOk, withApi } from "@/server/http";
import { loadInstruments } from "@/server/market-data/catalog";
import { isInstrumentActive } from "@/server/market-data/instruments";
import { buildPulseBoards } from "@/server/research/boards";
import { rankHighConfidence } from "@/server/research/confidence";
import { loadResearchSeries, refreshBhavcopy, refreshOpenInterest } from "@/server/research/sources";

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/screener/trigger", async ({ requestId }) => {
    const actor = await requireOperations(request);
    const startedAt = new Date().toISOString();
    const [bhavcopy, oi] = await Promise.all([refreshBhavcopy(), refreshOpenInterest()]);
    const now = new Date();
    const instruments = (await loadInstruments()).filter((item) => isInstrumentActive(item, now));
    const series = await loadResearchSeries(instruments.map((item) => item.symbol), now);
    const equity = instruments.filter((item) => item.segment === "equity").map((item) => item.symbol);
    const confidence = rankHighConfidence(Object.fromEntries(equity.map((symbol) => [symbol, series.bars[symbol] ?? []])));
    const boards = buildPulseBoards(instruments.map((item) => ({ symbol: item.symbol, candles: series.candles[item.symbol] ?? [] })));
    const summary = {
      bhavcopy,
      oi,
      source: series.source,
      standout: confidence.filter((row) => row.band === "stands out").length,
      scored: confidence.length,
      optionSelling: boards.optionSelling.length,
      sideways: boards.sideways.length,
    };
    await getDb().insert(jobRuns).values({
      id: createId("job"),
      job: "screener",
      status: "ok",
      summary: summary as unknown as Record<string, unknown>,
      actorId: actor.uid,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
    return apiOk({
      ...summary,
      notice: "The screen was run now. Sample prices are used until an end-of-day file is saved.",
    }, requestId);
  });
}
