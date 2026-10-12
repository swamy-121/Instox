import { eq } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { fcmTokens } from "@/server/db/schema";
import { apiOk, readJson, withApi } from "@/server/http";
import { syncUserTopics } from "@/server/notifications/dispatch";
import { tokenHash } from "@/server/notifications/push";

const bodySchema = z.object({ token: z.string().min(20).max(4096).regex(/^\S+$/) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/fcm-tokens", async ({ requestId }) => {
    const actor = await requireActor(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "The FCM device token is incomplete.", { token: "Send the Firebase registration token." });
    }
    const id = tokenHash(parsed.data.token);
    const db = getDb();
    const existing = await db.select().from(fcmTokens).where(eq(fcmTokens.id, id)).limit(1);
    if (existing[0] && existing[0].userId !== actor.uid) {
      throw new AppError(409, "STATE_CONFLICT", "That device token is already registered.");
    }
    const now = new Date().toISOString();
    await db.insert(fcmTokens).values({
      id,
      userId: actor.uid,
      token: parsed.data.token,
      platform: "web",
      revoked: false,
      createdAt: existing[0]?.createdAt ?? now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: fcmTokens.id,
      set: { token: parsed.data.token, revoked: false, updatedAt: now },
    });
    try {
      await syncUserTopics(actor.uid);
    } catch {
      // Topic membership can catch up on the next consent save. The token is already stored.
    }
    return apiOk({ id, revoked: false }, requestId, null, existing[0] ? 200 : 201);
  });
}
