import { requireActor } from "@/server/auth/actor";
import { viewerTier } from "@/server/authorization/entitlements";
import { apiOk, withApi } from "@/server/http";
import { listSaved } from "@/server/tips/library";
import { presentTip } from "@/server/tips/present";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/tips/saved", async ({ requestId }) => {
    const actor = await requireActor(request);
    const tier = viewerTier(actor.entitlement);
    const tips = await listSaved(actor.uid);
    return apiOk({ tips: tips.map((tip) => presentTip(tip, tier)) }, requestId);
  });
}
