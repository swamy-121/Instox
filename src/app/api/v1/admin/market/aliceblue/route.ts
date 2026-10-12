import { requireActor } from "@/server/auth/actor";
import { canAccessAdmin } from "@/server/authorization/roles";
import { AppError } from "@/lib/errors";
import { refreshIntegrations } from "@/server/integrations/store";
import { publicAliceStatus, readAliceConnection } from "@/server/market-data/alice-store";
import { activeFeedId } from "@/server/market-data/quotes";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/market/aliceblue", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canAccessAdmin(actor.roles)) throw new AppError(403, "FORBIDDEN", "You cannot view market connection status.");
    await refreshIntegrations();
    const connection = await readAliceConnection();
    return apiOk(publicAliceStatus(connection, activeFeedId()), requestId);
  });
}
