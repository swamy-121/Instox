"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TipCard } from "@/components/tip-card";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hello, {name}</h1>
        <p className="mt-1 text-sm text-muted">
          Access: {state.me.entitlement.tier}. Plan status: {state.me.entitlement.status}.
        </p>
      </div>
      <section className="card">
        <h2 className="font-semibold">Sample market strip</h2>
        <p className="mt-1 text-sm text-muted">{sample?.notice ?? "Sample data is not a quote."}</p>
        <p className="mt-1 text-xs text-muted">{sample?.provider.label}</p>
        <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          {sample?.quotes.map((quote) => (
            <li key={quote.symbol} className="rounded-xl bg-canvas px-3 py-2">
              <span className="font-medium">{quote.symbol}</span>
              <span className="mt-1 block tabular-nums">{quote.last ?? "Unavailable"}</span>
              <span className="text-xs text-muted">{quote.dataLabel}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Latest tips</h2>
          <Link href="/tips" className="text-sm text-primary">
            See all
          </Link>
        </div>
        {error ? <ErrorState message={error} requestId={requestId} onRetry={load} /> : null}
        {!feed && !error ? <LoadingState /> : null}
        {feed && feed.tips.length === 0 ? <EmptyState title="No published tips" body="Published tips will show up here." /> : null}
        <div className="space-y-3">{feed?.tips.map((tip) => <TipCard key={tip.id} tip={tip} />)}</div>
      </section>
      {state.me.entitlement.tier !== "premium" ? (
        <Link href="/pricing" className="btn-secondary">
          View premium placeholder
        </Link>
      ) : null}
    </div>
  );
}
