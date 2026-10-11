import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/health", async ({ requestId }) => {
    return apiOk({ status: "ok", service: "instox" }, requestId);
  });
}
