import { listContent } from "@/server/content/store";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/plans", async ({ requestId }) => {
    const [plans, docs] = await Promise.all([listContent("plans", "public"), listContent("contentDocs", "public")]);
    const note = docs.find((doc) => doc.id === "plans")?.body ?? "";
    const termsVersion = docs.find((doc) => doc.id === "plans")?.title ?? "";
    return apiOk({ termsVersion, note, plans }, requestId);
  });
}
