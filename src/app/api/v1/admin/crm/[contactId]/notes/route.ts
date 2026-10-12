import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireCrm } from "@/server/auth/operations";
import { addNote, getContactDetail } from "@/server/crm/repo";
import { apiOk, readJson, withApi } from "@/server/http";

const bodySchema = z.object({ body: z.string().max(2000) }).strict();

export async function POST(request: Request, context: { params: Promise<{ contactId: string }> }): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/crm/:contactId/notes", async ({ requestId }) => {
    const actor = await requireCrm(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Write a short note.", { body: "Enter a note." });
    const { contactId } = await context.params;
    await addNote(contactId, actor.uid, parsed.data.body);
    return apiOk(await getContactDetail(contactId), requestId, null, 201);
  });
}
