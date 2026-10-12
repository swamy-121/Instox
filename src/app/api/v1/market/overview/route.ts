import { listContent } from "@/server/content/store";
import { adminDb } from "@/server/db/admin";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/market/overview", async ({ requestId }) => {
    const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase() ?? "";
    const indices = await listContent("indices", "public");
    const chartSymbol = symbol || indices.find((row) => row.kind === "index")?.symbol || "";
    let candles: unknown[] = [];
    if (chartSymbol) {
      const doc = await adminDb().collection("candleSeries").doc(chartSymbol).get();
      const stored = doc.data()?.candles;
      if (Array.isArray(stored)) candles = stored;
    }
    const licensed = process.env.MARKET_DATA_LICENSED === "true";
    return apiOk(
      {
        indices,
        chartSymbol,
        candles,
        dataLabel: licensed ? "Live" : "Sample data",
        live: licensed,
      },
      requestId,
    );
  });
}
