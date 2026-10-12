import { recordAudit } from "@/server/audit/log";
import { requireOperations } from "@/server/auth/operations";
import { loadMemberCopy, parseMemberCopy, saveMemberCopy } from "@/server/content/member-config";
import { apiOk, readJson, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/app-config", async ({ requestId }) => {
    await requireOperations(request);
    const config = await loadMemberCopy();
    return apiOk({ config }, requestId);
  });
}

export async function PUT(request: Request): Promise<Response> {
  return withApi(request, "PUT /api/v1/admin/app-config", async ({ requestId }) => {
    const actor = await requireOperations(request, { recent: true });
    const config = parseMemberCopy(await readJson(request));
    await saveMemberCopy(config, actor.uid);
    await recordAudit({
      actorUid: actor.uid,
      action: "appConfig.member_copy_updated",
      targetType: "appConfig",
      targetId: "public",
      reason: "Saved member copy, version, and maintenance from the admin form.",
      requestId,
    });
    return apiOk({ config }, requestId);
  });
}
