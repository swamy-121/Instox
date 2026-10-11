import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";
import { endpointHash } from "@/server/notifications/push";

const bodySchema = z
  .object({
    endpoint: z.string().url().max(2000),
    keys: z.object({
      p256dh: z.string().min(1).max(200),
      auth: z.string().min(1).max(200),
    }),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/push-subscriptions", async ({ requestId }) => {
    const actor = await requireActor(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "The push subscription is incomplete.", {
        endpoint: "Send an endpoint and keys.",
      });
    }
    let endpoint: URL;
    try {
      endpoint = new URL(parsed.data.endpoint);
    } catch {
      throw new AppError(400, "VALIDATION_ERROR", "The push endpoint is not a URL.", { endpoint: "Use an https URL." });
    }
    if (endpoint.protocol !== "https:") {
      throw new AppError(400, "VALIDATION_ERROR", "The push endpoint must use https.", { endpoint: "Use an https URL." });
    }
    const id = endpointHash(parsed.data.endpoint);
    const db = adminDb();
    const ref = db.collection("pushSubscriptions").doc(id);
    const existing = await ref.get();
    if (existing.exists && existing.data()?.uid !== actor.uid) {
      throw new AppError(409, "STATE_CONFLICT", "That push endpoint is already registered.");
    }
    const now = new Date().toISOString();
    await ref.set({
      id,
      uid: actor.uid,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      revoked: false,
      createdAt: existing.data()?.createdAt ?? now,
      updatedAt: now,
    });
    return apiOk({ id, revoked: false }, requestId, null, existing.exists ? 200 : 201);
  });
}
