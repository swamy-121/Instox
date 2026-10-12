import { PUBLIC_CONTENT } from "@/server/content/registry";
import { assertContentName, listContent } from "@/server/content/store";
import { AppError } from "@/lib/errors";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request, context: { params: Promise<{ collection: string }> }): Promise<Response> {
  const { collection } = await context.params;
  return withApi(request, `GET /api/v1/content/${collection}`, async ({ requestId }) => {
    const name = assertContentName(collection);
    if (!PUBLIC_CONTENT.includes(name)) {
      throw new AppError(404, "NOT_FOUND", "That collection is not public.");
    }
    const records = await listContent(name, "public");
    const licensed = process.env.MARKET_DATA_LICENSED === "true";
    return apiOk(
      {
        records,
        dataLabel: licensed ? "Live" : "Sample data",
        live: licensed,
      },
      requestId,
    );
  });
}
