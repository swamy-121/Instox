import { z } from "zod";
import { AppError } from "@/lib/errors";
import { recordAudit } from "@/server/audit/log";
import { requireOperations } from "@/server/auth/operations";
import { getDb } from "@/server/db/client";
import { instruments } from "@/server/db/schema";
import { apiOk, readJson, withApi } from "@/server/http";
import { loadInstruments } from "@/server/market-data/catalog";
import { validateInstrumentImport } from "@/server/market-data/instruments";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/instruments", async ({ requestId }) => {
    await requireOperations(request);
    const rows = await loadInstruments();
    return apiOk({ dataLabel: "Sample data", live: false, instruments: rows }, requestId);
  });
}

const bodySchema = z.object({
  symbol: z.string().min(1).max(21),
  segment: z.enum(["equity", "futures", "options"]),
  tickSize: z.number().positive(),
  lotSize: z.number().int().positive().nullable().optional(),
  isEligible: z.boolean().optional(),
  eligibilitySource: z.string().min(1).max(80),
  effectiveFrom: z.string().min(8).max(40),
  effectiveTo: z.string().min(8).max(40).nullable().optional(),
  reason: z.string().min(3).max(500),
}).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/instruments", async ({ requestId }) => {
    const actor = await requireOperations(request, { recent: true });
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Review the instrument fields.", { form: "Check the instrument fields." });
    const instrument = validateInstrumentImport(parsed.data, { licensed: process.env.MARKET_DATA_LICENSED === "true" });
    const now = new Date().toISOString();
    await getDb().insert(instruments).values({ ...instrument, updatedAt: now, updatedBy: actor.uid }).onConflictDoUpdate({
      target: instruments.symbol,
      set: { ...instrument, updatedAt: now, updatedBy: actor.uid },
    });
    await recordAudit({ actorUid: actor.uid, action: "instrument.imported", targetType: "instrument", targetId: instrument.symbol, reason: parsed.data.reason, requestId });
    return apiOk({ instrument, dataLabel: "Sample data", live: false }, requestId, null, 201);
  });
}
