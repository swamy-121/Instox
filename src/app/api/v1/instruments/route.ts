import { requireActor } from "@/server/auth/actor";
import { apiOk, withApi } from "@/server/http";
import { loadInstruments } from "@/server/market-data/catalog";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/instruments", async ({ requestId }) => {
    await requireActor(request);
    const instruments = await loadInstruments();
    return apiOk(
      {
        dataLabel: "Sample data",
        live: false,
        instruments,
      },
      requestId,
    );
  });
}
