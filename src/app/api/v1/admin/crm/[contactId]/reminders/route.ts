import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireCrm } from "@/server/auth/operations";
import { addReminder, getContactDetail } from "@/server/crm/repo";
import { apiOk, readJson, withApi } from "@/server/http";

const bodySchema = z.object({ body: z.string().max(500), dueAt: z.string().max(40) }).strict();

export async function POST(request: Request, context: { params: Promise<{ contactId: string }> }): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/crm/:contactId/reminders", async ({ requestId }) => {
    const actor = await requireCrm(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Add a follow-up.", { form: "Reminder and date are required." });
    const { contactId } = await context.params;
    await addReminder(contactId, actor.uid, parsed.data.body, parsed.data.dueAt);
    return apiOk(await getContactDetail(contactId), requestId, null, 201);
  });
}
