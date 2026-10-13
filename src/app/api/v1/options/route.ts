import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { apiOk, withApi } from "@/server/http";
import { knownSampleLast, getMarketDataProvider } from "@/server/market-data/adapter";
import { optionBuyingIdeas, summarizeChain } from "@/server/research/chain";
import { loadOptionChain } from "@/server/research/sources";

const ALLOWED = new Set(["NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN"]);

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/options", async ({ requestId }) => {
    await requireActor(request);
    const underlying = new URL(request.url).searchParams.get("underlying")?.trim().toUpperCase() || "NIFTY";
    if (!ALLOWED.has(underlying)) {
      throw new AppError(400, "VALIDATION_ERROR", "Choose Nifty, Bank Nifty, or one of the sample stocks.");
    }
    const quotes = await getMarketDataProvider().getQuotes([underlying]);
    const spot = quotes[0]?.last ?? knownSampleLast(underlying) ?? 0;
    const chain = await loadOptionChain(underlying, spot > 0 ? spot : 100);
    const summary = summarizeChain(chain.rows);
    const ideas = optionBuyingIdeas(spot > 0 ? spot : 100, chain.rows, summary.bias);
    return apiOk({
      underlying,
      spot: spot > 0 ? spot : null,
      source: chain.source,
      tradeDate: chain.tradeDate,
      dataLabel: chain.source === "sample" ? "Sample data" : "End-of-day file",
      notice: chain.notice,
      summary,
      ideas,
      chainNote: "Open interest here is an end-of-day snapshot. It is not a live chain, and a sketch is not a trade instruction.",
    }, requestId);
  });
}
