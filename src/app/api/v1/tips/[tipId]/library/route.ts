import { requireActor } from "@/server/auth/actor";
import { apiOk, withApi } from "@/server/http";
import { libraryFlags } from "@/server/tips/library";

export async function GET(
  request: Request,
  context: { params: Promise<{ tipId: string }> },
): Promise<Response> {
  return withApi(request, "GET /api/v1/tips/:tipId/library", async ({ requestId }) => {
    const actor = await requireActor(request);
    const { tipId } = await context.params;
    return apiOk(await libraryFlags(actor.uid, tipId), requestId);
  });
}
