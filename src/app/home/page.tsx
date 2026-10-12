"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lightbulb, LineChart, Newspaper, ShoppingBag } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { FreshnessMark } from "@/components/freshness-mark";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TipCard } from "@/components/tip-card";
import { useAuth } from "@/features/auth/auth-provider";
import { mergeDisplayed } from "@/features/market/live-quotes";
import { useLiveQuotes } from "@/features/market/use-live-quotes";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/money";
import type { TipView } from "@/server/tips/present";

type Quote = { symbol: string; name: string; last: number; changePct: number; kind: "index" | "stock"; freshnessStatus?: string };
type Feed = { tips: TipView[]; viewerTier: string };
type Overview = { indices: Quote[]; feed?: string; dataLabel: string; live: boolean };

const GRID = [
  ["/tips", "Tips", Lightbulb],
  ["/screener", "Screener", LineChart],
  ["/news", "News", Newspaper],
  ["/shop", "Shop", ShoppingBag],
] as const;

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

  const live = useLiveQuotes(overview?.feed);
  if (state.status !== "ready") return null;
  const shown = (overview?.indices ?? []).map((row) => mergeDisplayed(row, live.quotes.get(row.symbol), overview?.feed, live.streamDown));
  const indices = shown.filter((row) => row.kind === "index");
  const quotes = new Map(shown.map((row) => [row.symbol, row]));

  return (
    <div className="space-y-6">
      {error ? <ErrorState message={error} requestId={requestId} onRetry={load} /> : null}
      {!feed && !error ? <LoadingState label="Loading home" /> : null}
      {overview ? (
        <section className="grid grid-cols-2 gap-3">
          {indices.length === 0 ? <EmptyState title="No indices" body="Publish index rows to show Nifty and Sensex." /> : null}
          {indices.map((row) => (
            <Link
              key={row.symbol}
              href={`/market?symbol=${row.symbol}`}
              className={`rounded-xl p-4 shadow-card ${row.changePct >= 0 ? "bg-[#E7F6EE]" : "bg-[#FDECEC]"}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{row.symbol}</p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-ink">{formatPrice(row.last)}</p>
              <p className={`text-sm font-semibold tabular-nums ${row.changePct >= 0 ? "text-profit" : "text-loss"}`}>
                {row.changePct >= 0 ? "+" : ""}
                {row.changePct.toFixed(2)}%
              </p>
              <FreshnessMark status={row.freshnessStatus} />
            </Link>
          ))}
        </section>
      ) : null}
      <section className="grid grid-cols-4 gap-3">
        {GRID.map(([href, label, Icon]) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-2 text-xs font-medium text-ink">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary shadow-card">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            {label}
          </Link>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Today&apos;s top picks</h2>
        {feed && feed.tips.length === 0 ? <EmptyState title="No picks" body="Mark a published tip as featured to show it here." /> : null}
        {feed?.tips.map((tip) => (
          <TipCard key={tip.id} tip={tip} quote={quotes.get(tip.symbol) ?? null} />
        ))}
      </section>
    </div>
  );
}
