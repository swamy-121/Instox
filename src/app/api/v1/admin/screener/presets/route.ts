import { z } from "zod";
import { AppError } from "@/lib/errors";
import { recordAudit } from "@/server/audit/log";
import { requireOperations } from "@/server/auth/operations";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";

const presetSchema = z
  .object({
    rsiPeriod: z.number().int().min(2).max(200),
    rsiBelow: z.number().min(0).max(100),
    rsiAbove: z.number().min(0).max(100),
    rsiSide: z.enum(["below", "above"]),
    emaPeriod: z.number().int().min(2).max(200),
    emaSide: z.enum(["above", "below"]),
    cprSide: z.enum(["above", "below", "inside"]),
  })
  .strip();

export type ScreenerPresets = z.infer<typeof presetSchema>;

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/screener/presets", async ({ requestId }) => {
    await requireOperations(request);
    const snap = await adminDb().collection("appConfig").doc("screenerPresets").get();
    const parsed = presetSchema.safeParse(snap.data() ?? {});
    return apiOk({ presets: parsed.success ? parsed.data : null }, requestId);
  });
}

export async function PUT(request: Request): Promise<Response> {
  return withApi(request, "PUT /api/v1/admin/screener/presets", async ({ requestId }) => {
    const actor = await requireOperations(request, { recent: true });
    const parsed = presetSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Check the screener settings.", { form: "Enter the periods and thresholds." });
    }
    const now = new Date().toISOString();
    await adminDb().collection("appConfig").doc("screenerPresets").set({
      ...parsed.data,
      updatedBy: actor.uid,
      updatedAt: now,
    });
    await recordAudit({
      actorUid: actor.uid,
      action: "screener.presets_updated",
      targetType: "appConfig",
      targetId: "screenerPresets",
      reason: "Saved screener settings from the admin form.",
      requestId,
    });
    return apiOk({ presets: parsed.data }, requestId);
  });
}
