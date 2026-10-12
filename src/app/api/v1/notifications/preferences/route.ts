import { eq } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
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
    await getDb().update(users).set({
      tipPush: parsed.data.tipPush,
      marketingPush: parsed.data.marketingPush,
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, actor.uid));
    try {
      await syncUserTopics(actor.uid);
    } catch {
      // Consent is saved. Topic membership is skipped when FCM credentials are empty.
    }
    return apiOk({ preferences: parsed.data }, requestId);
  });
}
