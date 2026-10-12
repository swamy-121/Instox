import type { CloseReason, TipCategory, TipStatus } from "@/types/domain";

export const CATEGORY_LABELS: Record<TipCategory, string> = {
  equity: "Equity",
  futures: "Futures",
  options: "Options",
  penny_stocks: "Penny stocks",
  intraday: "Intraday",
  btst: "BTST",
  short_term: "Short-term",
  long_term: "Long-term",
};

export const STATUS_LABELS: Record<TipStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  published: "Published",
  closed: "Closed",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const CLOSE_REASON_LABELS: Record<CloseReason, string> = {
  target_hit: "Target hit",
  stop_loss_hit: "Stop loss hit",
  time_expired: "Time expired",
  manually_closed: "Manually closed",
};

export function statusLabel(status: TipStatus, closeReason?: CloseReason | null): string {
  if (status === "closed" && closeReason) return `Closed, ${CLOSE_REASON_LABELS[closeReason]}`;
  return STATUS_LABELS[status];
}
