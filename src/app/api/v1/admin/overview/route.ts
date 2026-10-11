import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { canAccessAdmin } from "@/server/authorization/roles";
import { getMarketDataProvider } from "@/server/market-data/adapter";
import { apiOk, withApi } from "@/server/http";
import { countTipsByStatus } from "@/server/tips/repo";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/overview", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canAccessAdmin(actor.roles)) {
      throw new AppError(403, "FORBIDDEN", "You do not have admin access.");
    }
    const counts = await countTipsByStatus();
    return apiOk(
      {
        queue: {
          draft: counts.draft ?? 0,
          inReview: counts.in_review ?? 0,
          published: counts.published ?? 0,
        },
        paymentExceptions: [],
        failedJobs: [],
        marketData: getMarketDataProvider().health(),
        note: "Payment exceptions stay empty until a provider is approved. Market data is the sample adapter.",
      },
      requestId,
    );
  });
}
