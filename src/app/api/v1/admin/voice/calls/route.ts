import { applyPage } from "@/lib/list-page";
import { requireCrm } from "@/server/auth/operations";
import { apiOk, withApi } from "@/server/http";
import { listCalls } from "@/server/voice/service";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/voice/calls", async ({ requestId }) => {
    await requireCrm(request);
    const url = new URL(request.url);
    const calls = await listCalls({
      status: url.searchParams.get("status") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    const window = applyPage(calls, url.searchParams);
    return apiOk({ calls: window.items, total: window.total, page: window.page, pageSize: window.pageSize }, requestId);
  });
}
