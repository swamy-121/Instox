import { TIP_CATEGORIES, ACCESS_TIERS } from "@/types/domain";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { viewerTier } from "@/server/authorization/entitlements";
import { apiOk, withApi } from "@/server/http";
import { readPage } from "@/lib/list-page";
import { presentTip } from "@/server/tips/present";
import { listPublishedTips, listPublishedTipsPage } from "@/server/tips/repo";
import type { Actor } from "@/server/auth/actor";

async function optionalActor(request: Request): Promise<Actor | null> {
  const bearer = request.headers.get("authorization");
  const cookie = request.headers.get("cookie") ?? "";
  if (!bearer && !cookie.includes("instox_session=")) return null;
  return requireActor(request);
}

function limitOf(url: URL): number {
  const raw = Number(url.searchParams.get("limit") ?? "20");
  if (!Number.isInteger(raw) || raw < 1) return 20;
  return Math.min(raw, 50);
}

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/tips", async ({ requestId }) => {
    const actor = await optionalActor(request);
    const url = new URL(request.url);
    const category = url.searchParams.get("category") ?? undefined;
    const accessTier = url.searchParams.get("accessTier") ?? undefined;
    if (category && !TIP_CATEGORIES.includes(category as (typeof TIP_CATEGORIES)[number])) {
      throw new AppError(400, "VALIDATION_ERROR", "Unknown category.", { category: "Choose a known category." });
    }
    if (accessTier && !ACCESS_TIERS.includes(accessTier as (typeof ACCESS_TIERS)[number])) {
      throw new AppError(400, "VALIDATION_ERROR", "Unknown access tier.", { accessTier: "Use free or premium." });
    }
    const q = url.searchParams.get("q")?.trim().slice(0, 32) || undefined;
    const tier = viewerTier(actor?.entitlement ?? null);
    const paging = readPage(url.searchParams);
    if (paging.paged) {
      const result = await listPublishedTipsPage({
        category,
        accessTier,
        q,
        segment: url.searchParams.get("segment") ?? undefined,
        duration: url.searchParams.get("duration") ?? undefined,
        side: url.searchParams.get("side") ?? undefined,
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
        page: paging.page,
        pageSize: paging.pageSize,
      });
      return apiOk({
        tips: result.tips.map((tip) => presentTip(tip, tier)),
        viewerTier: tier,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      }, requestId);
    }
    const result = await listPublishedTips({
      category,
      accessTier,
      q,
      featured: url.searchParams.get("featured") === "1",
      cursor: url.searchParams.get("cursor"),
      limit: limitOf(url),
    });
    return apiOk(
      {
        tips: result.tips.map((tip) => presentTip(tip, tier)),
        viewerTier: tier,
      },
      requestId,
      result.nextCursor,
    );
  });
}
