import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { apiOk, withApi } from "@/server/http";
import { loadInstruments } from "@/server/market-data/catalog";

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> },
): Promise<Response> {
  return withApi(request, "GET /api/v1/instruments/:symbol", async ({ requestId }) => {
    await requireActor(request);
    const { symbol } = await context.params;
    const instruments = await loadInstruments();
    const instrument = instruments.find((item) => item.symbol === symbol.toUpperCase());
    if (!instrument) throw new AppError(404, "NOT_FOUND", "That instrument is not in the sample master.");
    return apiOk({ dataLabel: "Sample data", live: false, instrument }, requestId);
  });
}
