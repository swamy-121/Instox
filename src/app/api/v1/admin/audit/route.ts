import { AppError } from "@/lib/errors";
import { applyPage, inDateRange } from "@/lib/list-page";
import { requireActor } from "@/server/auth/actor";
import { canViewAudit } from "@/server/authorization/roles";
import { listAuditLogs } from "@/server/audit/log";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/audit", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canViewAudit(actor.roles)) throw new AppError(403, "FORBIDDEN", "You cannot view the audit log.");
    const url = new URL(request.url);
    const action = url.searchParams.get("action")?.trim().toLowerCase() ?? "";
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const logs = (await listAuditLogs(5000)).filter((row) => {
      if (action && !row.action.toLowerCase().includes(action)) return false;
      if (!inDateRange(row.occurredAt, url.searchParams.get("from"), url.searchParams.get("to"))) return false;
      if (!q) return true;
      return `${row.action} ${row.actorUid} ${row.targetType} ${row.targetId} ${row.reason}`.toLowerCase().includes(q);
    });
    const window = applyPage(logs, url.searchParams);
    return apiOk({ logs: window.items, total: window.total, page: window.page, pageSize: window.pageSize }, requestId);
  });
}
