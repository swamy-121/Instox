import { listContent } from "@/server/content/store";
import { adminDb } from "@/server/db/admin";
import { loadFeedQuotes } from "@/server/market-data/hub";
import { activeFeedId, applyLiveClose, overlayQuote, type Freshness } from "@/server/market-data/quotes";
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
    let rows = indices.map((row) => ({ ...row, freshnessStatus: "stored" as Freshness }));
    if (feed !== "mock") {
      const quotes = await loadFeedQuotes(indices.map((row) => row.symbol));
      rows = indices.map((row) => overlayQuote(row, quotes.get(row.symbol) ?? null, feed, now));
      const chartQuote = rows.find((row) => row.symbol === chartSymbol) ?? overlayQuote(
        { symbol: chartSymbol, last: 0, changePct: 0 },
        (await loadFeedQuotes([chartSymbol])).get(chartSymbol) ?? null,
        feed,
        now,
      );
      if (chartQuote.freshnessStatus === "live" || chartQuote.freshnessStatus === "stale") {
        candles = applyLiveClose(candles, chartQuote.last, null);
      }
    }
    const live = rows.some((row) => row.freshnessStatus === "live");
    return apiOk(
      {
        indices: rows,
        chartSymbol,
        candles,
        feed,
        dataLabel: live ? "Live" : feed === "dev" ? "Dev quotes" : "Sample data",
        live,
      },
      requestId,
    );
  });
}
