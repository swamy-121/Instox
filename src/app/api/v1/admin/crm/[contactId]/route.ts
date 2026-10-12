import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireCrm } from "@/server/auth/operations";
import { getContactDetail, updateContact } from "@/server/crm/repo";
import { CRM_STAGES } from "@/server/crm/model";
import { apiOk, readJson, withApi } from "@/server/http";

const patchSchema = z.object({
  stage: z.enum(CRM_STAGES).optional(),
  tags: z.array(z.string().max(32)).max(12).optional(),
  trialEndsAt: z.string().max(40).nullable().optional(),
  planId: z.string().max(64).nullable().optional(),
}).strict();

export async function GET(request: Request, context: { params: Promise<{ contactId: string }> }): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/crm/:contactId", async ({ requestId }) => {
    await requireCrm(request);
    const { contactId } = await context.params;
    return apiOk(await getContactDetail(contactId), requestId);
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ contactId: string }> }): Promise<Response> {
  return withApi(request, "PATCH /api/v1/admin/crm/:contactId", async ({ requestId }) => {
    const actor = await requireCrm(request);
    const parsed = patchSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Check the customer.", { form: "Stage, tags, or trial date were not valid." });
    const { contactId } = await context.params;
    await updateContact(contactId, parsed.data, actor.uid);
    return apiOk(await getContactDetail(contactId), requestId);
  });
}
