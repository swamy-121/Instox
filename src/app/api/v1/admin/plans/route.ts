import { requireOperations } from "@/server/auth/operations";
import { listContent } from "@/server/content/store";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/plans", async ({ requestId }) => {
    await requireOperations(request);
    const [plans, docs] = await Promise.all([listContent("plans", "admin"), listContent("contentDocs", "admin")]);
    const note = docs.find((doc) => doc.id === "plans")?.body ?? "";
    return apiOk({ termsVersion: docs.find((doc) => doc.id === "plans")?.title ?? "", note, plans }, requestId);
  });
}
