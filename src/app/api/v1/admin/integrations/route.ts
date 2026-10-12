import { z } from "zod";
import { AppError } from "@/lib/errors";
import { recordAudit } from "@/server/audit/log";
import { requireSuperAdmin } from "@/server/auth/operations";
import { fieldViews, refreshIntegrations, saveIntegrationFields } from "@/server/integrations/store";
import { apiOk, readJson, withApi } from "@/server/http";

const bodySchema = z
  .object({
    values: z.record(z.string().max(64), z.string().max(500)).optional(),
    clear: z.array(z.string().max(64)).max(20).optional(),
  })
  .strict();

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/integrations", async ({ requestId }) => {
    await requireSuperAdmin(request);
    const fields = await refreshIntegrations(true);
    return apiOk(
      {
        encryptionReady: (process.env.INTEGRATIONS_ENC_KEY ?? "").trim().length >= 16,
        fields: fieldViews(fields),
      },
      requestId,
    );
  });
}

export async function PUT(request: Request): Promise<Response> {
  return withApi(request, "PUT /api/v1/admin/integrations", async ({ requestId }) => {
    const actor = await requireSuperAdmin(request, { recent: true });
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Check the integration fields.", {
        form: "Send field names and values only.",
      });
    }
    const values = parsed.data.values ?? {};
    const clear = parsed.data.clear ?? [];
    const fields = await saveIntegrationFields({ values, clear, updatedBy: actor.uid });
    const names = [...Object.keys(values), ...clear.map((name) => `cleared ${name}`)];
    await recordAudit({
      actorUid: actor.uid,
      action: "integrations.updated",
      targetType: "appConfig",
      targetId: "integrations",
      reason: names.length > 0 ? `Updated ${names.join(", ")}.` : "Saved integration settings.",
      requestId,
    });
    return apiOk({ encryptionReady: true, fields: fieldViews(fields) }, requestId);
  });
}
