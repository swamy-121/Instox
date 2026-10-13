"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, Bookmark, LifeBuoy, Lightbulb, LineChart, Newspaper, ShoppingBag, Star, Crown, Clock } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { ChangeText, SampleBadge, SectionHead } from "@/components/design";
import { FreshnessMark } from "@/components/freshness-mark";
import { Sparkline } from "@/components/ui";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TipCard } from "@/components/tip-card";
import { useMemberConfig } from "@/features/app/member-config";
import { useAuth } from "@/features/auth/auth-provider";
import { mergeDisplayed } from "@/features/market/live-quotes";
import { isLiveIndex } from "@/lib/live-indices";
import { useLiveQuotes } from "@/features/market/use-live-quotes";
import { apiFetch } from "@/lib/api-client";
import { formatIstStamp, isSampleData, nseSession } from "@/lib/market-session";
import { formatPrice } from "@/lib/money";
import type { TipView } from "@/server/tips/present";

type Quote = { symbol: string; name: string; last: number; changePct: number; kind: "index" | "stock"; freshnessStatus?: string };
type Feed = { tips: TipView[]; viewerTier: string };
type Overview = { indices: Quote[]; feed?: string; dataLabel: string; live: boolean };
type Tile = { id: string; href: string; label: string; icon: string };
type Ad = { id: string; title: string; body: string; placement: string };
type Article = { id: string; title: string; source: string; publishedAt: string };
type WatchItem = { id: string; symbol: string };

const ICONS = {
  tips: Lightbulb,
  screener: LineChart,
  news: Newspaper,
  shop: ShoppingBag,
  market: Activity,
  watchlist: Bookmark,
  premium: Crown,
  help: LifeBuoy,
  pulse: Activity,
} as const;

const FALLBACK_TILES: Tile[] = [
  { id: "watchlist", href: "/watchlist", label: "Watchlist", icon: "watchlist" },
  { id: "screener", href: "/screener", label: "Screener", icon: "screener" },
  { id: "tips", href: "/tips", label: "Tips", icon: "tips" },
  { id: "pulse", href: "/pulse", label: "Pulse", icon: "pulse" },
];

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
  const [news, setNews] = useState<Article[]>([]);
  const [watch, setWatch] = useState<WatchItem[]>([]);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  const session = nseSession();

  function load() {
    setError(null);
    Promise.all([
      apiFetch<Feed>("/api/v1/tips?featured=1&limit=8"),
      apiFetch<Overview>("/api/v1/market/overview"),
      apiFetch<{ records: Tile[] }>("/api/v1/content/homeTiles"),
      apiFetch<{ records: Ad[] }>("/api/v1/content/advertisements"),
      apiFetch<{ records: Article[] }>("/api/v1/content/newsArticles"),
      apiFetch<{ items: WatchItem[] }>("/api/v1/watchlist"),
    ]).then(([tips, market, shortcuts, banners, stories, saved]) => {
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
      setLoadedAt(new Date().toISOString());
      if (shortcuts.ok && shortcuts.data.records.length > 0) setTiles(shortcuts.data.records);
      else setTiles(FALLBACK_TILES);
      if (banners.ok) setAds(banners.data.records.filter((row) => row.placement === "home"));
      if (stories.ok) setNews(stories.data.records.slice(0, 3));
      if (saved.ok) setWatch(saved.data.items);
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
      : { ...row, freshnessStatus: row.freshnessStatus ?? ("stored" as const) }
  ));
  const indices = shown.filter((row) => row.kind === "index");
  const quotes = new Map(shown.map((row) => [row.symbol, row]));
  const sample = isSampleData(overview?.dataLabel, overview?.live);
  const shortcuts = tiles ?? [];

  return (
    <div>
      {error ? <ErrorState message={error} requestId={requestId} onRetry={load} /> : null}
      {!feed && !error ? <LoadingState label="Loading home" /> : null}
      {overview ? (
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink">Market summary</h2>
            {sample ? <SampleBadge /> : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${session.open ? "bg-[#E6F4EC] text-profit" : "bg-[#EEF2EF] text-muted"}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {session.label}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {loadedAt ? `Last updated ${formatIstStamp(loadedAt)} IST` : "Waiting for a timestamp"}
            </span>
          </div>
          {indices.length === 0 ? <div className="mt-3"><EmptyState title="No indices" body="Nifty and Sensex will show up here soon." /></div> : null}
          <div className="mt-2.5 flex gap-2 overflow-x-auto lg:grid lg:grid-cols-4 lg:overflow-visible">
            {indices.map((row) => (
              <Link key={row.symbol} href={`/market?symbol=${encodeURIComponent(row.symbol)}`} className="card min-w-[164px] shrink-0 !p-3 lg:min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-muted">{row.symbol}</p>
                  <span className="text-[11px] text-muted">NSE</span>
                </div>
                <p className="num mt-1 text-[17px] font-bold text-ink lg:text-[22px]">{formatPrice(row.last)}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <ChangeText last={row.last} changePct={row.changePct} size="xs" />
                  <Sparkline seed={row.symbol} positive={row.changePct >= 0} />
                </div>
                <FreshnessMark status={row.freshnessStatus} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="lg:mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-5">
        <div>
          <SectionHead title={config.homePicksTitle} action={<Link href="/tips" className="text-[12.5px] font-semibold text-primary">View all</Link>} />
          {feed && feed.tips.length === 0 ? <EmptyState title="No picks" body="Featured ideas will show up here." /> : null}
          <div className="grid gap-2.5 lg:grid-cols-2">
            {feed?.tips.slice(0, 4).map((tip) => (
              <TipCard key={tip.id} tip={tip} quote={quotes.get(tip.symbol) ?? null} />
            ))}
          </div>
          <div className="lg:hidden">
            <SectionHead title="Latest news" action={<Link href="/news" className="text-[12.5px] font-semibold text-primary">More</Link>} />
            {news.length === 0 ? <EmptyState title="No stories" body="News will show up here when it is published." /> : (
              <ul className="card divide-y divide-line !p-0">
                {news.map((row) => (
                  <li key={row.id} className="px-3.5 py-3">
                    <p className="text-[13px] font-semibold text-ink">{row.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{row.source} · {new Date(row.publishedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div>
          <SectionHead title="Quick access" />
          <div className="grid grid-cols-4 gap-2 lg:grid-cols-2">
            {shortcuts.slice(0, 4).map((tile) => {
              const Icon = ICONS[tile.icon as keyof typeof ICONS] ?? Star;
              return (
                <Link key={tile.id} href={tile.href} className="card flex flex-col items-center gap-1.5 !p-3 text-center text-xs font-semibold text-ink lg:flex-row lg:justify-start lg:gap-2 lg:text-left lg:text-[13px]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {tile.label}
                </Link>
              );
            })}
          </div>
          <div className="hidden lg:block">
            <SectionHead title="Watchlist" action={<Link href="/watchlist" className="text-[12.5px] font-semibold text-primary">Edit</Link>} />
            {watch.length === 0 ? <EmptyState title="Nothing saved" body="Add a symbol from a tip or the watchlist page." /> : (
              <ul className="card divide-y divide-line !p-0">
                {watch.slice(0, 6).map((item) => {
                  const quote = quotes.get(item.symbol);
                  return (
                    <li key={item.id}>
                      <Link href={`/market?symbol=${encodeURIComponent(item.symbol)}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <span>
                          <span className="block text-[13px] font-bold text-ink">{item.symbol}</span>
                          <span className="text-[11px] text-muted">NSE</span>
                        </span>
                        {quote ? (
                          <span className="text-right">
                            <span className="num block text-[13px] font-semibold text-ink">{formatPrice(quote.last)}</span>
                            <ChangeText last={quote.last} changePct={quote.changePct} size="xs" />
                          </span>
                        ) : <span className="text-[11px] text-muted">Price unavailable</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {ads.map((ad) => (
        <article key={ad.id} className="mt-4 rounded-xl border border-line bg-white p-4">
          <p className="text-sm font-semibold text-ink">{ad.title}</p>
          <p className="mt-1 text-sm leading-6 text-muted">{ad.body}</p>
        </article>
      ))}
      {sample ? <p className="mt-4 text-[11px] text-muted">Values marked sample data are not live market prices.</p> : null}
    </div>
  );
}
