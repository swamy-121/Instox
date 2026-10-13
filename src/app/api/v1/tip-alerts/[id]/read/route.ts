import { requireActor } from "@/server/auth/actor";
import { apiOk, withApi } from "@/server/http";
import { markAlertRead } from "@/server/tips/library";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withApi(request, "POST /api/v1/tip-alerts/:id/read", async ({ requestId }) => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    await markAlertRead(actor.uid, id);
    return apiOk({ id, read: true }, requestId);
  });
}
