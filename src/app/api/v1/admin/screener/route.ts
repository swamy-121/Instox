import { z } from "zod";
import { AppError } from "@/lib/errors";
import { recordAudit } from "@/server/audit/log";
import { requireOperations } from "@/server/auth/operations";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";
import { loadRuntimeFlags } from "@/server/indicators/runtime";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/screener", async ({ requestId }) => {
    await requireOperations(request);
    const flags = await loadRuntimeFlags();
    return apiOk({ flags, note: "ATR and SuperTrend stay off unless a flag is saved here." }, requestId);
  });
}

const bodySchema = z
  .object({
    rsi: z.boolean().optional(),
    ema: z.boolean().optional(),
    cpr: z.boolean().optional(),
    atr: z.boolean().optional(),
    supertrend: z.boolean().optional(),
    reason: z.string().min(3).max(500),
  })
  .strict();

export async function PATCH(request: Request): Promise<Response> {
  return withApi(request, "PATCH /api/v1/admin/screener", async ({ requestId }) => {
    const actor = await requireOperations(request, { recent: true });
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Send indicator flags and a reason.", { reason: "Enter a reason." });
    }
    const current = await loadRuntimeFlags();
    const next = {
      rsi: parsed.data.rsi ?? current.rsi,
      ema: parsed.data.ema ?? current.ema,
      cpr: parsed.data.cpr ?? current.cpr,
      atr: parsed.data.atr ?? current.atr,
      supertrend: parsed.data.supertrend ?? current.supertrend,
    };
    const now = new Date().toISOString();
    await adminDb().collection("appConfig").doc("screener").set({
      ...next,
      updatedBy: actor.uid,
      updatedAt: now,
    });
    await recordAudit({
      actorUid: actor.uid,
      action: "screener.flags_updated",
      targetType: "appConfig",
      targetId: "screener",
      reason: parsed.data.reason,
      requestId,
    });
    return apiOk({ flags: next }, requestId);
  });
}
