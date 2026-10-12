import { listContent } from "@/server/content/store";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/shop", async ({ requestId }) => {
    const [products, docs] = await Promise.all([
      listContent("shopProducts", "public"),
      listContent("contentDocs", "public"),
    ]);
    return apiOk(
      {
        note: docs.find((doc) => doc.id === "shop")?.body ?? "",
        products,
        fulfillment: "unconfigured",
      },
      requestId,
    );
  });
}
