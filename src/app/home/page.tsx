"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, LifeBuoy, Lightbulb, LineChart, Newspaper, ShoppingBag, Star, Crown } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { FreshnessMark } from "@/components/freshness-mark";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TipCard } from "@/components/tip-card";
import { useMemberConfig } from "@/features/app/member-config";
import { useAuth } from "@/features/auth/auth-provider";
import { mergeDisplayed } from "@/features/market/live-quotes";
import { isLiveIndex } from "@/lib/live-indices";
import { useLiveQuotes } from "@/features/market/use-live-quotes";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/money";
import type { TipView } from "@/server/tips/present";

type Quote = { symbol: string; name: string; last: number; changePct: number; kind: "index" | "stock"; freshnessStatus?: string };
type Feed = { tips: TipView[]; viewerTier: string };
type Overview = { indices: Quote[]; feed?: string; dataLabel: string; live: boolean };
type Tile = { id: string; href: string; label: string; icon: string };
type Ad = { id: string; title: string; body: string; placement: string };

const ICONS = {
  tips: Lightbulb,
  screener: LineChart,
  news: Newspaper,
  shop: ShoppingBag,
  market: BarChart3,
  watchlist: Star,
  premium: Crown,
  help: LifeBuoy,
} as const;

export default function HomePage() {
  return (
    <AppFrame requireAuth>
      <HomeBody />
    </AppFrame>
  );
}

function HomeBody() {
  const { state } = useAuth();
  const config = useMemberConfig();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();

  function load() {
    setError(null);
    Promise.all([
      apiFetch<Feed>("/api/v1/tips?featured=1&limit=8"),
      apiFetch<Overview>("/api/v1/market/overview"),
      apiFetch<{ records: Tile[] }>("/api/v1/content/homeTiles"),
      apiFetch<{ records: Ad[] }>("/api/v1/content/advertisements"),
    ]).then(([tips, market, shortcuts, banners]) => {
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
      if (shortcuts.ok) setTiles(shortcuts.data.records);
      else setTiles([]);
      if (banners.ok) setAds(banners.data.records.filter((row) => row.placement === "home"));
    });
  }

  useEffect(() => {
    if (state.status === "ready") load();
  }, [state.status]);

  const live = useLiveQuotes(overview?.feed);
  if (state.status !== "ready") return null;
  const shown = (overview?.indices ?? []).map((row) => (
    isLiveIndex(row.symbol)
      ? mergeDisplayed(row, live.quotes.get(row.symbol), overview?.feed, live.streamDown)
      : { ...row, freshnessStatus: "stored" as const }
  ));
  const indices = shown.filter((row) => row.kind === "index");
  const quotes = new Map(shown.map((row) => [row.symbol, row]));

  return (
    <div className="space-y-6">
      {error ? <ErrorState message={error} requestId={requestId} onRetry={load} /> : null}
      {!feed && !error ? <LoadingState label="Loading home" /> : null}
      {overview ? (
        <section className="grid grid-cols-2 gap-3">
          {indices.length === 0 ? <EmptyState title="No indices" body="Nifty and Sensex will show up here soon." /> : null}
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
      {tiles && tiles.length === 0 ? <EmptyState title="No shortcuts" body="Shortcuts will show up here soon." /> : null}
      {tiles && tiles.length > 0 ? (
        <section className="grid grid-cols-4 gap-3">
          {tiles.map((tile) => {
            const Icon = ICONS[tile.icon as keyof typeof ICONS] ?? Lightbulb;
            return (
              <Link key={tile.id} href={tile.href} className="flex flex-col items-center gap-2 text-xs font-medium text-ink">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary shadow-card">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                {tile.label}
              </Link>
            );
          })}
        </section>
      ) : null}
      {ads.map((ad) => (
        <article key={ad.id} className="rounded-xl bg-primary-soft p-4 shadow-card">
          <p className="text-sm font-semibold text-ink">{ad.title}</p>
          <p className="mt-1 text-sm leading-6 text-muted">{ad.body}</p>
        </article>
      ))}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">{config.homePicksTitle}</h2>
        {feed && feed.tips.length === 0 ? <EmptyState title="No picks" body="Featured ideas will show up here." /> : null}
        {feed?.tips.map((tip) => (
          <TipCard key={tip.id} tip={tip} quote={quotes.get(tip.symbol) ?? null} />
        ))}
      </section>
    </div>
  );
}
