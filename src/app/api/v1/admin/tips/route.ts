import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { canEditTips } from "@/server/authorization/roles";
import { apiOk, readJson, withApi } from "@/server/http";
import { validateTipInput } from "@/lib/validation/tip";
import { readPage } from "@/lib/list-page";
import { createDraft, listAdminTips, listAdminTipsPage } from "@/server/tips/repo";
import { TIP_CATEGORIES, TIP_STATUSES } from "@/types/domain";

function limitOf(url: URL): number {
  const raw = Number(url.searchParams.get("limit") ?? "20");
  if (!Number.isInteger(raw) || raw < 1) return 20;
  return Math.min(raw, 50);
}

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/tips", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canEditTips(actor.roles)) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to the tip desk.");
    }
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const category = url.searchParams.get("category") ?? undefined;
    if (status && !TIP_STATUSES.includes(status as (typeof TIP_STATUSES)[number])) {
      throw new AppError(400, "VALIDATION_ERROR", "Unknown status.", { status: "Choose a known status." });
    }
    if (category && !TIP_CATEGORIES.includes(category as (typeof TIP_CATEGORIES)[number])) {
      throw new AppError(400, "VALIDATION_ERROR", "Unknown category.", { category: "Choose a known category." });
    }
    const paging = readPage(url.searchParams);
    if (paging.paged) {
      const result = await listAdminTipsPage({
        status,
        category,
        q: url.searchParams.get("q")?.trim().slice(0, 32) || undefined,
        author: url.searchParams.get("author")?.trim() || undefined,
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
        page: paging.page,
        pageSize: paging.pageSize,
      });
      return apiOk({ tips: result.tips, total: result.total, page: result.page, pageSize: result.pageSize }, requestId);
    }
    const result = await listAdminTips({
      status,
      category,
      q: url.searchParams.get("q")?.trim().slice(0, 32) || undefined,
      author: url.searchParams.get("author")?.trim() || undefined,
      cursor: url.searchParams.get("cursor"),
      limit: limitOf(url),
    });
    return apiOk({ tips: result.tips }, requestId, result.nextCursor);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/tips", async ({ requestId }) => {
    const actor = await requireActor(request);
    if (!canEditTips(actor.roles)) {
      throw new AppError(403, "FORBIDDEN", "You cannot create tips.");
    }
    const body = await readJson(request);
    if (body && typeof body === "object" && ("status" in body || "version" in body || "createdBy" in body)) {
      throw new AppError(400, "VALIDATION_ERROR", "Status and ownership are set by the server.");
    }
    const tip = validateTipInput(body);
    const created = await createDraft({ tip, actorUid: actor.uid, requestId });
    return apiOk({ tip: created }, requestId, null, 201);
  });
}
