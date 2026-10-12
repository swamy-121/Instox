import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { viewerTier } from "@/server/authorization/entitlements";
import { apiOk, withApi } from "@/server/http";
import { presentTip } from "@/server/tips/present";
import { getTip } from "@/server/tips/repo";
import type { Actor } from "@/server/auth/actor";

async function optionalActor(request: Request): Promise<Actor | null> {
  const bearer = request.headers.get("authorization");
  const cookie = request.headers.get("cookie") ?? "";
  if (!bearer && !cookie.includes("instox_session=")) return null;
  return requireActor(request);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ tipId: string }> },
): Promise<Response> {
  return withApi(request, "GET /api/v1/tips/:tipId", async ({ requestId }) => {
    const { tipId } = await context.params;
    const actor = await optionalActor(request);
    const tip = await getTip(tipId);
    if (!tip || tip.status !== "published") {
      throw new AppError(404, "NOT_FOUND", "That tip is not available.");
    }
    const tier = viewerTier(actor?.entitlement ?? null);
    return apiOk({ tip: presentTip(tip, tier), viewerTier: tier }, requestId);
  });
}
