import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, withApi } from "@/server/http";
import { syncUserTopics } from "@/server/notifications/dispatch";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withApi(request, "DELETE /api/v1/fcm-tokens/:id", async ({ requestId }) => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const ref = adminDb().collection("fcmTokens").doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.uid !== actor.uid) {
      throw new AppError(404, "NOT_FOUND", "That device token was not found.");
    }
    await ref.update({ revoked: true, updatedAt: new Date().toISOString() });
    try {
      await syncUserTopics(actor.uid);
    } catch {
      // The token is already revoked, so a later send will skip it.
    }
    return apiOk({ id, revoked: true }, requestId);
  });
}
