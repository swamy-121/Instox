import { requireOperations } from "@/server/auth/operations";
import { apiOk, withApi } from "@/server/http";
import { tipCheckUsage } from "@/server/tips/library";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/tip-checks", async ({ requestId }) => {
    await requireOperations(request);
    const usage = await tipCheckUsage();
    return apiOk({
      ...usage,
      note: "Counts are for Check a stock. The total shown is the latest 500 checks.",
    }, requestId);
  });
}
