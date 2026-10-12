import { listActivePlans, loadPlans } from "@/server/payments/plans";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/plans", async ({ requestId }) => {
    const file = loadPlans();
    return apiOk(
      {
        termsVersion: file.termsVersion,
        note: file.note,
        plans: listActivePlans(),
      },
      requestId,
    );
  });
}
