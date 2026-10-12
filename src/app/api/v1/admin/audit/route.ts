import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { canViewAudit } from "@/server/authorization/roles";
import { adminDb } from "@/server/db/admin";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/audit", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canViewAudit(actor.roles)) {
      throw new AppError(403, "FORBIDDEN", "You cannot view the audit log.");
    }
    const snap = await adminDb().collection("adminAuditLogs").orderBy("occurredAt", "desc").limit(50).get();
    const logs = snap.docs.map((doc) => doc.data());
    return apiOk({ logs }, requestId);
  });
}
