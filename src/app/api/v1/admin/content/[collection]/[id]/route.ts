import { requireOperations } from "@/server/auth/operations";
import { assertContentName, deleteContent } from "@/server/content/store";
import { apiOk, withApi } from "@/server/http";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ collection: string; id: string }> },
): Promise<Response> {
  const { collection, id } = await context.params;
  return withApi(request, `DELETE /api/v1/admin/content/${collection}/${id}`, async ({ requestId }) => {
    await requireOperations(request);
    const name = assertContentName(collection);
    await deleteContent(name, id);
    return apiOk({ id, deleted: true }, requestId);
  });
}
