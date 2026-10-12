import Link from "next/link";
import { LockIcon } from "@/components/icons";
import { Chip } from "@/components/ui";
import { CATEGORY_LABELS, statusLabel } from "@/lib/labels";
import { formatPrice } from "@/lib/money";
import type { OpenTipView, TipView } from "@/server/tips/present";

function isOpen(tip: TipView): tip is OpenTipView {
  return tip.locked === false;
}

function statusTone(reason: string | null | undefined): "profit" | "loss" | "neutral" {
  if (reason === "target_hit") return "profit";
  if (reason === "stop_loss_hit") return "loss";
  return "neutral";
}

function whenLabel(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TipCard({ tip }: { tip: TipView }) {
  const when = tip.publishedAt ?? tip.updatedAt;
  const reason = isOpen(tip) ? tip.closeReason : null;
  return (
    <Link href={`/tips/${tip.id}`} className="card block transition hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip>{CATEGORY_LABELS[tip.category]}</Chip>
            <Chip tone="info">{tip.side}</Chip>
            {tip.accessTier === "premium" ? <Chip tone="info">Premium</Chip> : null}
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight tabular-nums text-ink">{tip.symbol}</h2>
          <p className="mt-1 text-xs text-muted">{tip.timeframe}</p>
        </div>
        <Chip tone={statusTone(reason)}>{statusLabel(tip.status, reason)}</Chip>
      </div>
      {tip.locked ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
          <LockIcon className="h-4 w-4" />
          Levels stay hidden
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip>Entry {formatPrice(tip.entryMin)}</Chip>
          <Chip>SL {formatPrice(tip.stopLoss)}</Chip>
          {tip.targets[0] ? <Chip tone={reason === "target_hit" ? "profit" : "neutral"}>{tip.targets[0].label} {formatPrice(tip.targets[0].price)}</Chip> : null}
        </div>
      )}
      <p className="mt-3 text-xs text-muted">Updated {whenLabel(when)}</p>
    </Link>
  );
}
