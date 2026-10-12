import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";
import { syncUserTopics } from "@/server/notifications/dispatch";

const bodySchema = z.object({ tipPush: z.boolean(), marketingPush: z.boolean() }).strict();

export async function PATCH(request: Request): Promise<Response> {
  return withApi(request, "PATCH /api/v1/notifications/preferences", async ({ requestId }) => {
    const actor = await requireActor(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Choose whether tip alerts and marketing alerts are on.", {
        preferences: "Send tipPush and marketingPush.",
      });
    }
    await adminDb().collection("users").doc(actor.uid).update({
      tipPush: parsed.data.tipPush,
      marketingPush: parsed.data.marketingPush,
      updatedAt: new Date().toISOString(),
    });
    try {
      await syncUserTopics(actor.uid);
    } catch {
      // Consent is saved. Topic membership is skipped when FCM credentials are empty.
    }
    return apiOk({ preferences: parsed.data }, requestId);
  });
}
