import Link from "next/link";
import { Lock } from "lucide-react";
import { FreshnessMark } from "@/components/freshness-mark";
import { StockAvatar } from "@/components/illustrations";
import { formatPrice } from "@/lib/money";
import type { OpenTipView, TipView } from "@/server/tips/present";

export type TipQuote = { last: number | null; changePct: number | null; freshnessStatus?: string };

function isOpen(tip: TipView): tip is OpenTipView {
  return tip.locked === false;
}

function targetPrice(tip: OpenTipView, label: string, index: number): number | null {
  const named = tip.targets.find((target) => target.label.toUpperCase() === label);
  if (named) return named.price;
  return tip.targets[index]?.price ?? null;
}

export function TipCard({ tip, quote }: { tip: TipView; quote?: TipQuote | null }) {
  const open = isOpen(tip);
  const levels = open
    ? [
        ["Entry", tip.entryMin, "text-ink"],
        ["T1", targetPrice(tip, "T1", 0), "text-profit"],
        ["T2", targetPrice(tip, "T2", 1), "text-profit"],
        ["SL", tip.stopLoss, "text-loss"],
      ] as const
    : [];

  return (
    <Link href={`/tips/${tip.id}`} className="card block">
      <div className="flex items-center gap-3">
        <StockAvatar symbol={tip.symbol} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{tip.symbol}</p>
          <p className="text-xs text-muted">{tip.timeframe}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tip.side === "SELL" ? "bg-[#FDECEC] text-loss" : "bg-primary-soft text-primary"}`}>
          {tip.side}
        </span>
      </div>
      {quote && quote.last != null && quote.changePct != null ? (
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-xs text-muted">LTP</p>
            <p className="text-xl font-semibold tabular-nums text-ink">{formatPrice(quote.last)}</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-semibold tabular-nums ${quote.changePct >= 0 ? "text-profit" : "text-loss"}`}>
              {quote.changePct >= 0 ? "+" : ""}
              {quote.changePct.toFixed(2)}%
            </p>
            <FreshnessMark status={quote.freshnessStatus} />
          </div>
        </div>
      ) : quote?.freshnessStatus === "offline" || quote?.freshnessStatus === "stale" ? (
        <p className="mt-3 text-xs text-muted"><FreshnessMark status={quote.freshnessStatus} /></p>
      ) : null}
      {open ? (
        <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-line pt-3 text-xs">
          {levels.map(([label, value, tone]) => (
            <div key={label}>
              <dt className="text-muted">{label}</dt>
              <dd className={`mt-0.5 font-semibold tabular-nums ${tone}`}>{value === null ? "-" : formatPrice(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-sm font-medium text-primary">
          <Lock className="h-4 w-4" aria-hidden="true" />
          Levels stay hidden
        </p>
      )}
    </Link>
  );
}
