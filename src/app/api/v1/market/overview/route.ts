import { listContent } from "@/server/content/store";
import { adminDb } from "@/server/db/admin";
import { isLiveIndex } from "@/lib/live-indices";
import { readAliceConnection } from "@/server/market-data/alice-store";
import { loadFeedQuotes } from "@/server/market-data/hub";
import { activeFeedId, applyLiveClose, presentIndexQuote, type Freshness } from "@/server/market-data/quotes";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/market/overview", async ({ requestId }) => {
    const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase() ?? "";
    const indices = await listContent("indices", "public");
    const chartSymbol = symbol || indices.find((row) => row.kind === "index")?.symbol || "";
    let candles: Array<{ close: number; closeTime?: string }> = [];
    if (chartSymbol) {
      const doc = await adminDb().collection("candleSeries").doc(chartSymbol).get();
      const stored = doc.data()?.candles;
      if (Array.isArray(stored)) candles = stored;
    }
    const feed = activeFeedId();
    const now = Date.now();
    const connected = feed === "aliceblue" ? (await readAliceConnection()).connected : feed === "dev";
    let rows = indices.map((row) => ({ ...row, freshnessStatus: "stored" as Freshness }));
    if (feed !== "mock") {
      const quotes = await loadFeedQuotes(indices.filter((row) => isLiveIndex(row.symbol)).map((row) => row.symbol));
      rows = indices.map((row) => presentIndexQuote(row, quotes.get(row.symbol) ?? null, feed, connected, now));
      const chartRow = rows.find((row) => row.symbol === chartSymbol);
      if (chartRow && isLiveIndex(chartSymbol) && (chartRow.freshnessStatus === "live" || chartRow.freshnessStatus === "stale" || chartRow.freshnessStatus === "delayed")) {
        candles = applyLiveClose(candles, chartRow.last, null);
      }
    }
    const live = rows.some((row) => row.freshnessStatus === "live");
    return apiOk(
      {
        indices: rows,
        chartSymbol,
        candles,
        feed,
        connected,
        dataLabel: live ? "Live" : "Sample data",
        live,
      },
      requestId,
    );
  });
}
