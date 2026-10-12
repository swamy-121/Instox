"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { StockAvatar } from "@/components/illustrations";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { Chip, PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { CATEGORY_LABELS, statusLabel } from "@/lib/labels";
import { formatPrice } from "@/lib/money";
import type { OpenTipView, TipView } from "@/server/tips/present";

function isOpen(tip: TipView): tip is OpenTipView {
  return tip.locked === false;
}

export default function TipDetailPage() {
  return (
    <AppFrame>
      <Detail />
    </AppFrame>
  );
}

function Detail() {
  const params = useParams<{ tipId: string }>();
  const [tip, setTip] = useState<TipView | null>(null);
  const [quote, setQuote] = useState<{ last: number; changePct: number } | null>(null);
  const [error, setError] = useState<{ message: string; code: string; requestId?: string } | null>(null);

  function load() {
    setError(null);
    apiFetch<{ tip: TipView }>(`/api/v1/tips/${params.tipId}`).then((result) => {
      if (!result.ok) {
        setError({ message: result.message, code: result.code, requestId: result.requestId });
        return;
      }
      setTip(result.data.tip);
      apiFetch<{ records: Array<{ symbol: string; last: number; changePct: number }> }>("/api/v1/content/indices").then((market) => {
        if (!market.ok) return;
        const match = market.data.records.find((row) => row.symbol === result.data.tip.symbol);
        setQuote(match ?? null);
      });
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tipId]);

  if (error?.code === "FORBIDDEN" || error?.code === "ACCOUNT_DISABLED") return <PermissionDenied message={error.message} />;
  if (error) return <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />;
  if (!tip) return <LoadingState label="Loading tip" />;

  const reason = isOpen(tip) ? tip.closeReason : null;

  return (
    <article>
      <div className="mb-4 flex items-center gap-3">
        <StockAvatar symbol={tip.symbol} />
        <PageHeader title={tip.symbol} lede={`${CATEGORY_LABELS[tip.category]} · ${tip.timeframe}`} />
      </div>
      {quote ? (
        <p className="mb-4 text-sm tabular-nums text-ink">
          LTP {formatPrice(quote.last)}{" "}
          <span className={quote.changePct >= 0 ? "font-semibold text-profit" : "font-semibold text-loss"}>
            {quote.changePct >= 0 ? "+" : ""}
            {quote.changePct.toFixed(2)}%
          </span>
        </p>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip tone="info">{tip.side}</Chip>
        <Chip tone={reason === "target_hit" ? "profit" : reason === "stop_loss_hit" ? "loss" : "neutral"}>
          {statusLabel(tip.status, reason)}
        </Chip>
        {tip.accessTier === "premium" ? <Chip tone="info">Premium</Chip> : <Chip>Free</Chip>}
      </div>
      <p className="text-xs text-muted">
        Published {tip.publishedAt ? new Date(tip.publishedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "not yet"}
      </p>
      {tip.locked ? <PremiumLock /> : <OpenLevels tip={tip} />}
      <WatchButton symbol={tip.symbol} />
    </article>
  );
}

function WatchButton({ symbol }: { symbol: string }) {
  const [message, setMessage] = useState<string | null>(null);
  async function add() {
    const result = await apiFetch<{ symbol: string }>("/api/v1/watchlist", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    });
    setMessage(result.ok ? `${result.data.symbol} is on your watchlist.` : result.message);
  }
  return (
    <div className="mt-4">
      <button type="button" className="btn-primary w-full" onClick={() => void add()}>Add to watchlist</button>
      {message ? <p className="mt-2 text-sm text-muted" role="status">{message}</p> : null}
    </div>
  );
}

function PremiumLock() {
  return (
    <div className="relative mt-6 overflow-hidden rounded-lg border border-line bg-white">
      <div className="pointer-events-none select-none space-y-3 p-4 blur-md" aria-hidden="true">
        <div className="grid grid-cols-3 gap-2">
          <div className="h-16 rounded-xl bg-canvas" />
          <div className="h-16 rounded-xl bg-canvas" />
          <div className="h-16 rounded-xl bg-canvas" />
        </div>
        <div className="h-4 w-2/3 rounded bg-line" />
        <div className="h-4 w-1/2 rounded bg-line" />
        <div className="h-20 rounded-xl bg-canvas" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/75 px-6 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-lg font-semibold text-ink">Premium idea</h2>
        <p className="mt-1 max-w-xs text-sm leading-6 text-muted">
          Entry, stop, targets, and the write-up stay on the server until a plan is active.
        </p>
        <Link href="/pricing" className="btn-primary mt-4">
          View plans
        </Link>
      </div>
    </div>
  );
}

function OpenLevels({ tip }: { tip: OpenTipView }) {
  const levels = [
    ["Entry", formatPrice(tip.entryMin)],
    ["Stop", formatPrice(tip.stopLoss)],
    ...tip.targets.map((target) => [target.label, formatPrice(target.price)] as const),
  ];
  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {levels.map(([label, value]) => (
          <div key={label} className="card p-3">
            <p className="text-xs font-medium text-muted">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{value}</p>
          </div>
        ))}
      </div>
      {tip.optionType ? (
        <p className="text-sm text-muted">
          {tip.optionType} {tip.strikePrice} · expiry {tip.expiry} · lot {tip.lotSize}
        </p>
      ) : null}
      <section className="card">
        <h2 className="text-sm font-semibold text-ink">Rationale</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{tip.thesis}</p>
        <p className="mt-4 text-xs text-muted">Risk disclosure {tip.riskDisclosureVersion}</p>
      </section>
    </div>
  );
}
