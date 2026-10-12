import features from "../../../config/features.json";
import type { CloseReason, TipStatus } from "@/types/domain";

export const INSIGHTS_VERSION = features.insights.version;

export type InsightTip = {
  id: string;
  symbol: string;
  status: TipStatus;
  closeReason: CloseReason | null;
  publishedAt: string | null;
  accessTier: "free" | "premium";
};

export type InsightOutcome = "win" | "loss" | "unresolved" | "cancelled" | "excluded";

export type InsightReport = {
  calculationVersion: string;
  timezone: string;
  periodStart: string;
  periodEnd: string;
  populationDefinition: string;
  totalTips: number;
  closedTips: number;
  wins: number;
  losses: number;
  unresolved: number;
  cancelled: number;
  winRate: number | null;
  winRateDenominator: string;
  rows: Array<InsightTip & { outcome: InsightOutcome }>;
  assumptions: string[];
};

export function zonedDayStart(now: Date, offsetMinutes = features.insights.offsetMinutes): Date {
  const shifted = new Date(now.getTime() + offsetMinutes * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - offsetMinutes * 60 * 1000);
}

export function insightWindow(now: Date, days = features.insights.defaultDays): { start: Date; end: Date } {
  const end = new Date(zonedDayStart(now).getTime() + 24 * 60 * 60 * 1000);
  const start = new Date(zonedDayStart(now).getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { start, end };
}

export function classifyOutcome(tip: Pick<InsightTip, "status" | "closeReason">): InsightOutcome {
  if (tip.status === "cancelled") return "cancelled";
  if (tip.status === "closed" && tip.closeReason === "target_hit") return "win";
  if (tip.status === "closed" && tip.closeReason === "stop_loss_hit") return "loss";
  if (tip.status === "closed" || tip.status === "expired" || tip.status === "published") return "unresolved";
  return "excluded";
}

/**
 * Last N Asia/Kolkata calendar days, ending today, using publishedAt in [start, end).
 * Win rate uses wins and stop-loss losses only. Unclosed, expired, manually closed,
 * and time-expired tips stay unresolved. Cancelled tips are counted aside and are not wins.
 */
export function buildInsightReport(tips: InsightTip[], now: Date, days = 30): InsightReport {
  const { start, end } = insightWindow(now, days);
  const rows = tips
    .filter((tip) => {
      if (!tip.publishedAt) return false;
      const time = Date.parse(tip.publishedAt);
      return time >= start.getTime() && time < end.getTime();
    })
    .map((tip) => ({ ...tip, outcome: classifyOutcome(tip) }));

  const wins = rows.filter((row) => row.outcome === "win").length;
  const losses = rows.filter((row) => row.outcome === "loss").length;
  const unresolved = rows.filter((row) => row.outcome === "unresolved").length;
  const cancelled = rows.filter((row) => row.outcome === "cancelled").length;
  const closedTips = rows.filter((row) => row.status === "closed").length;
  const denominator = wins + losses;

  return {
    calculationVersion: INSIGHTS_VERSION,
    timezone: features.insights.timezone,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    populationDefinition:
      "Tips with publishedAt inside the Asia/Kolkata window. Cancelled tips are excluded from the win-rate denominator. Unresolved tips are shown and are not treated as wins.",
    totalTips: rows.length,
    closedTips,
    wins,
    losses,
    unresolved,
    cancelled,
    winRate: denominator === 0 ? null : Math.round((wins / denominator) * 1000) / 10,
    winRateDenominator: "wins divided by wins plus stop-loss losses",
    rows,
    assumptions: [
      "Outcomes come from the manual close reason, not from an automatic price feed.",
      "A candle that touches both target and stop is not auto-resolved.",
      "No fees, slippage, or taxes are applied.",
      "Hypothetical profit is not shown.",
    ],
  };
}
