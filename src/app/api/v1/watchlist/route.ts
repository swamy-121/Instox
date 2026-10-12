import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { watchlistItems } from "@/server/db/schema";
import { apiOk, readJson, withApi } from "@/server/http";

const bodySchema = z.object({ symbol: z.string().min(1).max(32) }).strict();

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/watchlist", async ({ requestId }) => {
    const actor = await requireActor(request);
    const rows = await getDb().select().from(watchlistItems).where(eq(watchlistItems.userId, actor.uid)).limit(50);
    const items = rows
      .map((row) => ({ id: row.id, symbol: row.symbol, createdAt: row.createdAt }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
    return apiOk({ items }, requestId);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/watchlist", async ({ requestId }) => {
    const actor = await requireActor(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Send a symbol.", { symbol: "Enter a symbol." });
    const symbol = parsed.data.symbol.toUpperCase();
    const id = `${actor.uid}_${symbol}`;
    const now = new Date().toISOString();
    await getDb().insert(watchlistItems).values({ id, userId: actor.uid, symbol, createdAt: now }).onConflictDoNothing();
    return apiOk({ id, symbol, createdAt: now }, requestId, null, 201);
  });
}

export async function DELETE(request: Request): Promise<Response> {
  return withApi(request, "DELETE /api/v1/watchlist", async ({ requestId }) => {
    const actor = await requireActor(request);
    const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase() ?? "";
    if (!symbol) throw new AppError(400, "VALIDATION_ERROR", "Send a symbol.", { symbol: "Enter a symbol." });
    const id = `${actor.uid}_${symbol}`;
    const db = getDb();
    const rows = await db.select().from(watchlistItems).where(and(eq(watchlistItems.id, id), eq(watchlistItems.userId, actor.uid))).limit(1);
    if (!rows[0]) throw new AppError(404, "NOT_FOUND", "That symbol is not on your watchlist.");
    await db.delete(watchlistItems).where(eq(watchlistItems.id, id));
    return apiOk({ id, symbol, removed: true }, requestId);
  });
}
