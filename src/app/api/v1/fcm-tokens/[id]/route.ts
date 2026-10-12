import { eq } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { fcmTokens } from "@/server/db/schema";
import { apiOk, withApi } from "@/server/http";
import { syncUserTopics } from "@/server/notifications/dispatch";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return withApi(request, "DELETE /api/v1/fcm-tokens/:id", async ({ requestId }) => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const db = getDb();
    const rows = await db.select().from(fcmTokens).where(eq(fcmTokens.id, id)).limit(1);
    if (!rows[0] || rows[0].userId !== actor.uid) throw new AppError(404, "NOT_FOUND", "That device token was not found.");
    await db.update(fcmTokens).set({ revoked: true, updatedAt: new Date().toISOString() }).where(eq(fcmTokens.id, id));
    try {
      await syncUserTopics(actor.uid);
    } catch {
      // The token is already revoked, so a later send will skip it.
    }
    return apiOk({ id, revoked: true }, requestId);
  });
}
