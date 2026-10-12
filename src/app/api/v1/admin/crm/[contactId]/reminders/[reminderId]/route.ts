import { requireCrm } from "@/server/auth/operations";
import { completeReminder, getContactDetail } from "@/server/crm/repo";
import { apiOk, withApi } from "@/server/http";

export async function POST(request: Request, context: { params: Promise<{ contactId: string; reminderId: string }> }): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/crm/:contactId/reminders/:reminderId", async ({ requestId }) => {
    await requireCrm(request);
    const { contactId, reminderId } = await context.params;
    await completeReminder(contactId, reminderId);
    return apiOk(await getContactDetail(contactId), requestId);
  });
}
