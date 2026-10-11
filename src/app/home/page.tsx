"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TipCard } from "@/components/tip-card";
import { Chip, PageHeader, Sparkline } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/money";
import type { TipView } from "@/server/tips/present";
import type { ProviderHealth, SampleQuote } from "@/server/market-data/adapter";

type Feed = { tips: TipView[]; viewerTier: string };
type Sample = { provider: ProviderHealth; notice: string; quotes: SampleQuote[] };

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
  const [sample, setSample] = useState<Sample | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();

  function load() {
    setError(null);
    Promise.all([apiFetch<Feed>("/api/v1/tips?limit=5"), apiFetch<Sample>("/api/v1/market/sample")]).then(([tips, market]) => {
      if (!tips.ok) {
        setError(tips.message);
        setRequestId(tips.requestId);
        return;
      }
      setFeed(tips.data);
      if (market.ok) setSample(market.data);
    });
  }

  useEffect(() => {
    if (state.status === "ready") load();
  }, [state.status]);

  if (state.status !== "ready") return null;
  const name = state.me.displayName || "there";

  const tier = state.me.entitlement.tier === "premium" ? "Premium" : "Free";

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Hello, ${name}`}
        lede={`${tier} access. Plan status: ${state.me.entitlement.status}.`}
      />
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Sample quotes</h2>
            <p className="mt-1 text-xs leading-5 text-muted">{sample?.notice ?? "These figures are sample data for layout. They are not market prices."}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/pulse" className="text-sm font-medium text-primary">
              Pulse
            </Link>
            <Chip>Sample</Chip>
          </div>
        </div>
        <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {sample?.quotes.map((quote) => (
            <QuoteCard key={quote.symbol} quote={quote} />
          ))}
        </ul>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Latest tips</h2>
          <Link href="/tips" className="text-sm font-medium text-primary">
            See all
          </Link>
        </div>
        {error ? <ErrorState message={error} requestId={requestId} onRetry={load} /> : null}
        {!feed && !error ? <LoadingState /> : null}
        {feed && feed.tips.length === 0 ? <EmptyState title="No published tips" body="Published tips will show up here." /> : null}
        <div className="space-y-3">{feed?.tips.map((tip) => <TipCard key={tip.id} tip={tip} />)}</div>
      </section>
      {state.me.entitlement.tier !== "premium" ? (
        <Link href="/pricing" className="card flex items-center justify-between gap-4 hover:border-primary/40">
          <span>
            <span className="block text-sm font-semibold text-ink">Premium ideas</span>
            <span className="mt-1 block text-sm leading-6 text-muted">Entry, stop, and targets stay hidden until a plan is active.</span>
          </span>
          <span className="text-sm font-semibold text-primary">View plans</span>
        </Link>
      ) : null}
    </div>
  );
}

function changeClass(change: number | null, positive: boolean) {
  if (change === null) return "text-muted";
  return positive ? "text-profit" : "text-loss";
}

function QuoteCard({ quote }: { quote: SampleQuote }) {
  const change = quote.sampleChangePct;
  const positive = change !== null && change >= 0;
  return (
    <li className="card w-40 shrink-0 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{quote.symbol}</p>
        {change !== null ? <Sparkline seed={quote.symbol} positive={positive} /> : null}
      </div>
      <p className="mt-3 text-lg font-semibold tabular-nums tracking-tight text-ink">
        {quote.last === null ? "Unavailable" : formatPrice(quote.last)}
      </p>
      <p className={`mt-1 text-xs font-medium tabular-nums ${changeClass(change, positive)}`}>
        {change === null ? quote.dataLabel : `${positive ? "+" : ""}${change.toFixed(2)}%`}
      </p>
    </li>
  );
}
