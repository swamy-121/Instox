import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireCrm } from "@/server/auth/operations";
import { apiOk, readJson, withApi } from "@/server/http";
import { CAMPAIGN_KINDS, VOICE_LANGUAGES, VOICE_OPTIONS } from "@/server/voice/catalog";
import { createCampaign, listCampaigns, updateCampaign } from "@/server/voice/service";

const createSchema = z.object({
  name: z.string().max(80),
  kind: z.enum(["renewal_reminder", "trial_followup", "inbound_faq"]),
  language: z.enum(["te", "hi", "en"]),
  voice: z.enum(["anushka", "vidya", "abhilash"]),
  prompt: z.string().max(4000),
}).strict();

const patchSchema = createSchema.partial().extend({ id: z.string().min(4).max(80) }).strict();

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/voice/campaigns", async ({ requestId }) => {
    await requireCrm(request);
    return apiOk({
      campaigns: await listCampaigns(),
      kinds: CAMPAIGN_KINDS,
      languages: VOICE_LANGUAGES,
      voices: VOICE_OPTIONS,
    }, requestId);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/voice/campaigns", async ({ requestId }) => {
    const actor = await requireCrm(request);
    const parsed = createSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Check the campaign.", { form: "Name, type, language, voice, and script are required." });
    const id = await createCampaign({ ...parsed.data, authorId: actor.uid });
    return apiOk({ id }, requestId, null, 201);
  });
}

export async function PATCH(request: Request): Promise<Response> {
  return withApi(request, "PATCH /api/v1/admin/voice/campaigns", async ({ requestId }) => {
    await requireCrm(request);
    const parsed = patchSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Check the campaign.", { form: "The script could not be saved." });
    const { id, ...patch } = parsed.data;
    await updateCampaign(id, patch);
    return apiOk({ campaigns: await listCampaigns() }, requestId);
  });
}
