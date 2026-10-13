import { requireActor } from "@/server/auth/actor";
import { apiOk, withApi } from "@/server/http";
import { setTracked } from "@/server/tips/library";

export async function POST(
  request: Request,
  context: { params: Promise<{ tipId: string }> },
): Promise<Response> {
  return withApi(request, "POST /api/v1/tips/:tipId/track", async ({ requestId }) => {
    const actor = await requireActor(request);
    const { tipId } = await context.params;
    return apiOk(await setTracked(actor.uid, tipId, true), requestId);
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ tipId: string }> },
): Promise<Response> {
  return withApi(request, "DELETE /api/v1/tips/:tipId/track", async ({ requestId }) => {
    const actor = await requireActor(request);
    const { tipId } = await context.params;
    return apiOk(await setTracked(actor.uid, tipId, false), requestId);
  });
}
