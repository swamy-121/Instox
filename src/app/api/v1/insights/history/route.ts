import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { viewerTier } from "@/server/authorization/entitlements";
import { adminDb } from "@/server/db/admin";
import { apiOk, withApi } from "@/server/http";
import { buildInsightReport, type InsightTip } from "@/server/insights/report";
import type { TipStatus } from "@/types/domain";

const STATUSES: TipStatus[] = ["published", "closed", "cancelled", "expired"];

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/insights/history", async ({ requestId }) => {
    const actor = await requireActor(request);
    const rawDays = new URL(request.url).searchParams.get("days") ?? "30";
    const days = Number(rawDays);
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      throw new AppError(400, "VALIDATION_ERROR", "Choose a window from 1 to 90 days.", { days: "Use 1 to 90." });
    }
    const db = adminDb();
    const snaps = await Promise.all(
      STATUSES.map((status) => db.collection("tips").where("status", "==", status).limit(200).get()),
    );
    const tips: InsightTip[] = snaps.flatMap((snap) =>
      snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          symbol: String(data.symbol ?? ""),
          status: data.status,
          closeReason: data.closeReason ?? null,
          publishedAt: data.publishedAt ? String(data.publishedAt) : null,
          accessTier: data.accessTier === "premium" ? "premium" : "free",
        };
      }),
    );
    const report = buildInsightReport(tips, new Date(), days);
    const tier = viewerTier(actor.entitlement);
    const rows = report.rows.map((row) =>
      tier === "free" && row.accessTier === "premium" ? { ...row, symbol: "Premium" } : row,
    );
    return apiOk({ ...report, rows, viewerTier: tier }, requestId);
  });
}
