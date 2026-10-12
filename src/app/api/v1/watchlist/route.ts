import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";

const bodySchema = z.object({ symbol: z.string().min(1).max(32) }).strict();

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/watchlist", async ({ requestId }) => {
    const actor = await requireActor(request);
    const snap = await adminDb().collection("watchlistItems").where("uid", "==", actor.uid).limit(50).get();
    const items = snap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          symbol: String(data.symbol ?? ""),
          createdAt: String(data.createdAt ?? ""),
        };
      })
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
    return apiOk({ items }, requestId);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/watchlist", async ({ requestId }) => {
    const actor = await requireActor(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Send a symbol.", { symbol: "Enter a symbol." });
    }
    const symbol = parsed.data.symbol.toUpperCase();
    const id = `${actor.uid}_${symbol}`;
    const now = new Date().toISOString();
    await adminDb().collection("watchlistItems").doc(id).set({
      id,
      uid: actor.uid,
      symbol,
      createdAt: now,
    });
    return apiOk({ id, symbol, createdAt: now }, requestId, null, 201);
  });
}

export async function DELETE(request: Request): Promise<Response> {
  return withApi(request, "DELETE /api/v1/watchlist", async ({ requestId }) => {
    const actor = await requireActor(request);
    const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase() ?? "";
    if (!symbol) throw new AppError(400, "VALIDATION_ERROR", "Send a symbol.", { symbol: "Enter a symbol." });
    const id = `${actor.uid}_${symbol}`;
    const ref = adminDb().collection("watchlistItems").doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.uid !== actor.uid) {
      throw new AppError(404, "NOT_FOUND", "That symbol is not on your watchlist.");
    }
    await ref.delete();
    return apiOk({ id, symbol, removed: true }, requestId);
  });
}
