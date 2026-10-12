import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";
import { syncUserTopics } from "@/server/notifications/dispatch";
import { tokenHash } from "@/server/notifications/push";

const bodySchema = z
  .object({
    token: z.string().min(20).max(4096).regex(/^\S+$/),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/fcm-tokens", async ({ requestId }) => {
    const actor = await requireActor(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "The FCM device token is incomplete.", {
        token: "Send the Firebase registration token.",
      });
    }
    const id = tokenHash(parsed.data.token);
    const db = adminDb();
    const ref = db.collection("fcmTokens").doc(id);
    const existing = await ref.get();
    if (existing.exists && existing.data()?.uid !== actor.uid) {
      throw new AppError(409, "STATE_CONFLICT", "That device token is already registered.");
    }
    const now = new Date().toISOString();
    await ref.set({
      id,
      uid: actor.uid,
      token: parsed.data.token,
      platform: "web",
      revoked: false,
      createdAt: existing.data()?.createdAt ?? now,
      updatedAt: now,
    });
    try {
      await syncUserTopics(actor.uid);
    } catch {
      // Topic membership can catch up on the next consent save. The token is already stored.
    }
    return apiOk({ id, revoked: false }, requestId, null, existing.exists ? 200 : 201);
  });
}
