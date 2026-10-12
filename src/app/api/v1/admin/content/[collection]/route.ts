import { requireOperations } from "@/server/auth/operations";
import { assertContentName, listContent, saveContent } from "@/server/content/store";
import { apiOk, readJson, withApi } from "@/server/http";

export async function GET(request: Request, context: { params: Promise<{ collection: string }> }): Promise<Response> {
  const { collection } = await context.params;
  return withApi(request, `GET /api/v1/admin/content/${collection}`, async ({ requestId }) => {
    await requireOperations(request);
    const name = assertContentName(collection);
    const records = await listContent(name, "admin");
    return apiOk({ records }, requestId);
  });
}

export async function POST(request: Request, context: { params: Promise<{ collection: string }> }): Promise<Response> {
  const { collection } = await context.params;
  return withApi(request, `POST /api/v1/admin/content/${collection}`, async ({ requestId }) => {
    await requireOperations(request);
    const name = assertContentName(collection);
    const record = await saveContent(name, await readJson(request));
    return apiOk({ record }, requestId, null, 201);
  });
}
