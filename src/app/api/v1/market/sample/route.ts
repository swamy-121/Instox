import { getMarketDataProvider } from "@/server/market-data/adapter";
import { apiOk, withApi } from "@/server/http";

const SYMBOLS = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "NIFTY"];

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/market/sample", async ({ requestId }) => {
    const provider = getMarketDataProvider();
    const quotes = await provider.getSampleQuotes(SYMBOLS);
    return apiOk(
      {
        provider: provider.health(),
        notice: "These figures are sample data for layout. They are not market prices.",
        quotes,
      },
      requestId,
    );
  });
}
