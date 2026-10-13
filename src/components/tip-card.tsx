import Link from "next/link";
import { Clock, Crown, Lock } from "lucide-react";
import { FreshnessMark } from "@/components/freshness-mark";
import { ChangeText, Pill, SidePill, StatusDot } from "@/components/design";
import { CATEGORY_LABELS, statusLabel } from "@/lib/labels";
import { formatPrice } from "@/lib/money";
import type { OpenTipView, TipView } from "@/server/tips/present";
import type { CloseReason, TipStatus } from "@/types/domain";

export type TipQuote = { last: number | null; changePct: number | null; freshnessStatus?: string };

function isOpen(tip: TipView): tip is OpenTipView {
  return tip.locked === false;
}

function statusTone(status: TipStatus, reason: CloseReason | null): { label: string; tone: "brand" | "up" | "down" | "neutral" | "amber" } {
  if (status === "published") return { label: "Active", tone: "brand" };
  if (status === "expired" || reason === "time_expired") return { label: "Expired", tone: "neutral" };
  if (reason === "target_hit") return { label: "Target hit", tone: "up" };
  if (reason === "stop_loss_hit") return { label: "SL hit", tone: "down" };
  if (status === "closed") return { label: "Closed", tone: "neutral" };
  if (status === "cancelled") return { label: "Cancelled", tone: "neutral" };
  return { label: statusLabel(status, reason), tone: "amber" };
}

function published(iso: string | null): string {
  if (!iso) return "Not published yet";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function TipCard({ tip, quote }: { tip: TipView; quote?: TipQuote | null }) {
  const open = isOpen(tip);
  const reason = open ? tip.closeReason : null;
  const status = statusTone(tip.status, reason);
  const targets = open ? tip.targets.map((target) => formatPrice(target.price)).join(" / ") : "";
  const entry = open
    ? tip.entryMax != null && tip.entryMax !== tip.entryMin
      ? `${formatPrice(tip.entryMin)} – ${formatPrice(tip.entryMax)}`
      : formatPrice(tip.entryMin)
    : "";

  return (
    <article className="card !p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/tips/${tip.id}`} className="text-[15px] font-bold tracking-tight text-ink hover:underline">
              {tip.symbol}
            </Link>
            <SidePill side={tip.side} />
          </div>
          <p className="mt-0.5 text-[11px] text-muted">
            {CATEGORY_LABELS[tip.category]} · {tip.timeframe}
          </p>
        </div>
        <StatusDot tone={status.tone}>{status.label}</StatusDot>
      </div>
      {quote && quote.last != null && quote.changePct != null ? (
        <p className="mt-2 flex items-baseline gap-2">
          <span className="num text-lg font-bold text-ink">{formatPrice(quote.last)}</span>
          <ChangeText last={quote.last} changePct={quote.changePct} size="xs" />
          <FreshnessMark status={quote.freshnessStatus} />
        </p>
      ) : quote?.freshnessStatus ? (
        <p className="mt-2">
          <FreshnessMark status={quote.freshnessStatus} />
        </p>
      ) : null}
      {open ? (
        <dl className="mt-3 grid grid-cols-3 gap-2 rounded-[10px] bg-canvas px-3 py-2.5">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">Entry</dt>
            <dd className="num mt-0.5 text-[13px] font-bold text-ink">{entry}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">Stop-loss</dt>
            <dd className="num mt-0.5 text-[13px] font-bold text-loss">{formatPrice(tip.stopLoss)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">Targets</dt>
            <dd className="num mt-0.5 text-[13px] font-bold text-profit">{targets || "—"}</dd>
          </div>
        </dl>
      ) : (
        <div className="mt-3 rounded-[10px] bg-canvas px-3 py-3.5 text-center text-muted">
          <Lock className="mx-auto h-4 w-4" aria-hidden="true" />
          <p className="mt-1 text-[13px] font-semibold">Entry, stop-loss and targets are for Premium members</p>
          <Link href="/premium" className="btn-primary mt-2 h-9 px-3 text-[13px]">
            Unlock with Premium
          </Link>
        </div>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-[11px] text-muted">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Published {published(tip.publishedAt)}
        </p>
        {tip.accessTier === "premium" ? (
          <Pill tone="amber">
            <Crown className="h-3 w-3" aria-hidden="true" />
            Premium
          </Pill>
        ) : (
          <Pill>Free</Pill>
        )}
      </div>
    </article>
  );
}
