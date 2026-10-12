import { desc, eq } from "drizzle-orm";
import { requireActor } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { subscriptions } from "@/server/db/schema";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/subscriptions", async ({ requestId }) => {
    const actor = await requireActor(request);
    const rows = await getDb().select().from(subscriptions).where(eq(subscriptions.userId, actor.uid)).orderBy(desc(subscriptions.createdAt)).limit(20);
    return apiOk({
      subscriptions: rows.map((row) => ({
        id: row.id,
        planId: row.planId,
        status: row.status,
        periodEnd: row.periodEnd,
        createdAt: row.createdAt,
      })),
    }, requestId);
  });
}
