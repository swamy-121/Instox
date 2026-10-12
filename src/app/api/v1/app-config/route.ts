import { apiOk, withApi } from "@/server/http";
import { loadMemberCopy } from "@/server/content/member-config";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/app-config", async ({ requestId }) => {
    const config = await loadMemberCopy();
    return apiOk({ config }, requestId);
  });
}
