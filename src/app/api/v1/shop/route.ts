import { loadShop } from "@/server/shop/catalog";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/shop", async ({ requestId }) => {
    const file = loadShop();
    return apiOk(
      {
        note: file.note,
        products: file.products.filter((product) => product.active),
        fulfillment: "unconfigured",
      },
      requestId,
    );
  });
}
