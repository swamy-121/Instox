import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { canAccessAdmin } from "@/server/authorization/roles";
import { getMarketDataProvider } from "@/server/market-data/adapter";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/health", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canAccessAdmin(actor.roles)) throw new AppError(403, "FORBIDDEN", "You do not have admin access.");
    return apiOk({
      service: "instox",
      database: "postgres",
      auth: "session",
      marketData: getMarketDataProvider().health(),
      payments: { provider: "stub", grantsEntitlement: false },
    }, requestId);
  });
}
