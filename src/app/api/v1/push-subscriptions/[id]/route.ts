import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, withApi } from "@/server/http";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withApi(request, "DELETE /api/v1/push-subscriptions/:id", async ({ requestId }) => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const ref = adminDb().collection("pushSubscriptions").doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.uid !== actor.uid) {
      throw new AppError(404, "NOT_FOUND", "That push subscription was not found.");
    }
    await ref.update({ revoked: true, updatedAt: new Date().toISOString() });
    return apiOk({ id, revoked: true }, requestId);
  });
}
