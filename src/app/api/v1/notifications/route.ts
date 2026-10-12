import { eq } from "drizzle-orm";
import { requireActor } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { fcmTokens, users } from "@/server/db/schema";
import { refreshIntegrations } from "@/server/integrations/store";
import { apiOk, withApi } from "@/server/http";
import { clientMessagingConfigured, fcmConfigured } from "@/server/notifications/push";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/notifications", async ({ requestId }) => {
    const actor = await requireActor(request);
    await refreshIntegrations();
    const db = getDb();
    const [userRows, tokens] = await Promise.all([
      db.select().from(users).where(eq(users.id, actor.uid)).limit(1),
      db.select().from(fcmTokens).where(eq(fcmTokens.userId, actor.uid)).limit(20),
    ]);
    const user = userRows[0];
    return apiOk({
      preferences: { tipPush: user?.tipPush === true, marketingPush: user?.marketingPush === true },
      devices: tokens.map((row) => ({ id: row.id, revoked: row.revoked, createdAt: row.createdAt })),
      fcmConfigured: fcmConfigured(),
      clientConfigured: clientMessagingConfigured(),
    }, requestId);
  });
}
