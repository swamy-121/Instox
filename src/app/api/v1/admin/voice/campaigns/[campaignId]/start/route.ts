import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireCrm } from "@/server/auth/operations";
import { apiOk, readJson, withApi } from "@/server/http";
import { startCampaign } from "@/server/voice/service";

const bodySchema = z.object({ contactIds: z.array(z.string().max(80)).max(25).optional() }).strict();

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/voice/campaigns/:campaignId/start", async ({ requestId }) => {
    await requireCrm(request);
    const parsed = bodySchema.safeParse(await readJson(request).catch(() => ({})));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Choose who to call.", { form: "Contact ids were not valid." });
    const { campaignId } = await context.params;
    const base = process.env.APP_BASE_URL?.trim() || null;
    const result = await startCampaign(campaignId, parsed.data.contactIds, base);
    return apiOk(result, requestId);
  });
}
