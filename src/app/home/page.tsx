"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Chip } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/money";
import type { OpenTipView, TipView } from "@/server/tips/present";

type Quote = { symbol: string; name: string; last: number; changePct: number; kind: "index" | "stock" };
type Feed = { tips: TipView[]; viewerTier: string };
type Overview = { indices: Quote[]; dataLabel: string; live: boolean };

const GRID = [
  ["/tips", "Tips"],
  ["/screener", "Screener"],
  ["/news", "News"],
  ["/shop", "Shop"],
] as const;

function isOpen(tip: TipView): tip is OpenTipView {
  return tip.locked === false;
}

export default function HomePage() {
  return (
    <AppFrame requireAuth>
      <HomeBody />
    </AppFrame>
  );
}

function HomeBody() {
  const { state } = useAuth();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();

  function load() {
    setError(null);
    Promise.all([
      apiFetch<Feed>("/api/v1/tips?featured=1&limit=8"),
      apiFetch<Overview>("/api/v1/market/overview"),
    ]).then(([tips, market]) => {
      if (!tips.ok) {
        setError(tips.message);
        setRequestId(tips.requestId);
        return;
      }
      setFeed(tips.data);
      if (!market.ok) {
        setError(market.message);
        setRequestId(market.requestId);
        return;
      }
      setOverview(market.data);
    });
  }

  useEffect(() => {
    if (state.status === "ready") load();
  }, [state.status]);

  if (state.status !== "ready") return null;
  const name = state.me.displayName || "there";
  const indices = overview?.indices.filter((row) => row.kind === "index") ?? [];
  const quotes = new Map((overview?.indices ?? []).map((row) => [row.symbol, row]));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted">Hi, {name}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Let us find your next opportunity</h1>
      </header>
      {error ? <ErrorState message={error} requestId={requestId} onRetry={load} /> : null}
      {!feed && !error ? <LoadingState label="Loading home" /> : null}
      {overview ? (
        <section className="grid grid-cols-2 gap-3">
          {indices.length === 0 ? <EmptyState title="No indices" body="Publish index rows to show Nifty and Sensex." /> : null}
          {indices.map((row) => (
            <Link key={row.symbol} href={`/market?symbol=${row.symbol}`} className="card">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{row.symbol}</p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-ink">{formatPrice(row.last)}</p>
              <p className={`text-sm font-medium tabular-nums ${row.changePct >= 0 ? "text-profit" : "text-loss"}`}>
                {row.changePct >= 0 ? "+" : ""}{row.changePct.toFixed(2)}%
              </p>
            </Link>
          ))}
        </section>
      ) : null}
      {overview ? <p className="text-xs text-muted">{overview.live ? "Live" : overview.dataLabel}. These figures are stored records, not a vendor feed.</p> : null}
      <section className="grid grid-cols-4 gap-2">
        {GRID.map(([href, label]) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-card border border-line bg-white px-2 py-3 text-xs font-medium text-ink shadow-card">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{label.slice(0, 1)}</span>
            {label}
          </Link>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Today&apos;s top picks</h2>
        {feed && feed.tips.length === 0 ? <EmptyState title="No picks" body="Mark a published tip as featured to show it here." /> : null}
        {feed?.tips.map((tip) => {
          const quote = quotes.get(tip.symbol);
          const open = isOpen(tip);
          return (
            <Link key={tip.id} href={`/tips/${tip.id}`} className="card block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-ink">{tip.symbol}</p>
                  <p className="text-xs text-muted">{tip.timeframe}</p>
                </div>
                <Chip tone="info">{tip.side}</Chip>
              </div>
              {quote ? (
                <p className="mt-3 text-sm tabular-nums text-ink">
                  LTP {formatPrice(quote.last)}{" "}
                  <span className={quote.changePct >= 0 ? "text-profit" : "text-loss"}>
                    {quote.changePct >= 0 ? "+" : ""}{quote.changePct.toFixed(2)}%
                  </span>
                </p>
              ) : null}
              {open ? (
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-xs text-muted">Entry</dt><dd className="tabular-nums font-medium">{formatPrice(tip.entryMin)}</dd></div>
                  <div><dt className="text-xs text-muted">SL</dt><dd className="tabular-nums font-medium text-loss">{formatPrice(tip.stopLoss)}</dd></div>
                  {tip.targets.slice(0, 2).map((target) => (
                    <div key={target.label}><dt className="text-xs text-muted">{target.label}</dt><dd className="tabular-nums font-medium text-profit">{formatPrice(target.price)}</dd></div>
                  ))}
                </dl>
              ) : (
                <p className="mt-3 text-sm text-muted">Premium levels stay hidden until your plan is active.</p>
              )}
            </Link>
          );
        })}
      </section>
    </div>
  );
}
