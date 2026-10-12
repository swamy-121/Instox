import { z } from "zod";
import { AppError } from "@/lib/errors";
import { recordAudit } from "@/server/audit/log";
import { requireSuperAdmin } from "@/server/auth/operations";
import { isIntegrationGroup, probeIntegration } from "@/server/integrations/probe";
import { apiOk, readJson, withApi } from "@/server/http";

const bodySchema = z.object({ integration: z.string().min(1).max(40) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/integrations/test", async ({ requestId }) => {
    const actor = await requireSuperAdmin(request, { recent: true });
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success || !isIntegrationGroup(parsed.data.integration)) {
      throw new AppError(400, "VALIDATION_ERROR", "Choose an integration to test.", { integration: "Unknown integration." });
    }
    const result = await probeIntegration(parsed.data.integration);
    await recordAudit({
      actorUid: actor.uid,
      action: "integrations.tested",
      targetType: "appConfig",
      targetId: parsed.data.integration,
      reason: result.ok ? `Connection test succeeded for ${parsed.data.integration}.` : `Connection test failed for ${parsed.data.integration}.`,
      requestId,
    });
    return apiOk(result, requestId);
  });
}
