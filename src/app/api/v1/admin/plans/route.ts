import { requireOperations } from "@/server/auth/operations";
import { apiOk, withApi } from "@/server/http";
import { loadPlans } from "@/server/payments/plans";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/plans", async ({ requestId }) => {
    await requireOperations(request);
    const file = loadPlans();
    return apiOk({ termsVersion: file.termsVersion, note: file.note, plans: file.plans }, requestId);
  });
}
