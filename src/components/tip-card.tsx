import Link from "next/link";
import { CATEGORY_LABELS, statusLabel } from "@/lib/labels";
import { formatPrice } from "@/lib/money";
import type { OpenTipView, TipView } from "@/server/tips/present";

function isOpen(tip: TipView): tip is OpenTipView {
  return tip.locked === false;
}

export function TipCard({ tip }: { tip: TipView }) {
  const when = tip.publishedAt ?? tip.updatedAt;
  return (
    <Link href={`/tips/${tip.id}`} className="card block transition hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{CATEGORY_LABELS[tip.category]}</p>
          <h2 className="mt-1 text-lg font-semibold tabular-nums text-ink">{tip.symbol}</h2>
        </div>
        <span className="rounded-full bg-canvas px-2 py-1 text-xs font-medium text-ink">{tip.side}</span>
      </div>
      <p className="mt-3 text-sm text-ink">
        Status: {statusLabel(tip.status, isOpen(tip) ? tip.closeReason : null)}
      </p>
      <p className="mt-1 text-sm text-muted">Updated {new Date(when).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
      {tip.locked ? (
        <p className="mt-3 text-sm font-medium text-primary">Premium. Locked preview.</p>
      ) : (
        <p className="mt-3 text-sm tabular-nums text-ink">
          Entry {formatPrice(tip.entryMin)} · SL {formatPrice(tip.stopLoss)}
        </p>
      )}
    </Link>
  );
}
