import { requireActor } from "@/server/auth/actor";
import { viewerTier } from "@/server/authorization/entitlements";
import { apiOk, withApi } from "@/server/http";
import { savedSymbols } from "@/server/tips/library";
import { presentTip } from "@/server/tips/present";
import { rankRecommended } from "@/server/tips/recommend";
import { listPublishedForRecommend } from "@/server/tips/repo";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/tips/recommended", async ({ requestId }) => {
    const actor = await requireActor(request);
    const tier = viewerTier(actor.entitlement);
    const [published, symbols] = await Promise.all([
      listPublishedForRecommend(40),
      savedSymbols(actor.uid),
    ]);
    const tips = rankRecommended(published, symbols, 8);
    return apiOk({
      tips: tips.map((tip) => presentTip(tip, tier)),
      note: "Featured ideas come first, then symbols you have saved. This is a reading list, not a promise.",
    }, requestId);
  });
}
