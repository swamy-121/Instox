"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, Plus } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { ChangeText, FilterChip, SampleBadge } from "@/components/design";
import { FreshnessMark } from "@/components/freshness-mark";
import { AreaChart } from "@/components/illustrations";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { mergeDisplayed } from "@/features/market/live-quotes";
import { isLiveIndex } from "@/lib/live-indices";
import { useLiveQuotes } from "@/features/market/use-live-quotes";
import { apiFetch } from "@/lib/api-client";
import { formatIstStamp, isSampleData } from "@/lib/market-session";
import { formatPrice } from "@/lib/money";

type Quote = { symbol: string; name: string; last: number; changePct: number; kind: "index" | "stock"; freshnessStatus?: string };
type Candle = { close: number; closeTime: string };
type Payload = { indices: Quote[]; chartSymbol: string; candles: Candle[]; feed?: string; dataLabel: string; live: boolean };

const RANGES = [
  { id: "1D", count: 2 },
  { id: "1W", count: 5 },
  { id: "1M", count: 22 },
  { id: "1Y", count: 252 },
  { id: "5Y", count: 1260 },
] as const;

export default function MarketPage() {
  return (
    <AppFrame requireAuth>
      <Suspense fallback={<LoadingState label="Loading market" />}>
        <MarketBody />
      </Suspense>
    </AppFrame>
  );
}

function MarketBody() {
  const params = useSearchParams();
  const symbol = params.get("symbol") ?? "";
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("1M");
  const [board, setBoard] = useState<"gainers" | "losers">("gainers");
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [watchNote, setWatchNote] = useState<string | null>(null);
  const live = useLiveQuotes(payload?.feed);

  function load() {
    setError(null);
    const query = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
    apiFetch<Payload>(`/api/v1/market/overview${query}`).then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPayload(result.data);
      setLoadedAt(new Date().toISOString());
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const shown = (payload?.indices ?? []).map((row) => (
    isLiveIndex(row.symbol)
      ? mergeDisplayed(row, live.quotes.get(row.symbol), payload?.feed, live.streamDown)
      : { ...row, freshnessStatus: "stored" as const }
  ));
  const indices = shown.filter((row) => row.kind === "index");
  const stocks = [...shown.filter((row) => row.kind === "stock")].sort((a, b) => b.changePct - a.changePct);
  const gainers = stocks.filter((row) => row.changePct >= 0);
  const losers = [...stocks].reverse().filter((row) => row.changePct < 0);
  const movers = board === "gainers" ? gainers : losers;
  const count = RANGES.find((item) => item.id === range)?.count ?? 22;
  const chartRow = shown.find((row) => row.symbol === payload?.chartSymbol);
  const closes = (payload?.candles ?? []).slice(-count).map((candle) => candle.close);
  if (chartRow && isLiveIndex(chartRow.symbol) && (chartRow.freshnessStatus === "live" || chartRow.freshnessStatus === "stale" || chartRow.freshnessStatus === "delayed") && closes.length > 0) {
    closes[closes.length - 1] = chartRow.last;
  }

  const focus = symbol ? shown.find((row) => row.symbol === symbol) ?? chartRow : null;
  const sample = isSampleData(payload?.dataLabel, payload?.live);

  async function addWatch() {
    if (!focus) return;
    const result = await apiFetch("/api/v1/watchlist", { method: "POST", body: JSON.stringify({ symbol: focus.symbol }) });
    setWatchNote(result.ok ? `${focus.symbol} is on your watchlist.` : result.message);
  }

  return (
    <div className="space-y-3">
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!payload && !error ? <LoadingState label="Loading market" /> : null}
      {payload && indices.length === 0 && !focus ? <EmptyState title="No market data" body="Market data will show up here soon." /> : null}
      {focus ? (
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-bold tracking-tight text-ink">{focus.symbol}</h2>
            <span className="rounded-full bg-[#EEF2EF] px-2 py-0.5 text-[11px] font-semibold text-muted">{focus.kind === "index" ? "Index" : "NSE"}</span>
          </div>
          {focus.name ? <p className="text-sm text-muted">{focus.name}</p> : null}
          <p className="mt-2 flex items-baseline gap-2">
            <span className="num text-[30px] font-bold tracking-tight text-ink">{formatPrice(focus.last)}</span>
            <ChangeText last={focus.last} changePct={focus.changePct} />
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted">{loadedAt ? `As of ${formatIstStamp(loadedAt)} IST` : "Timestamp unavailable"}</p>
            {sample ? <SampleBadge /> : null}
            <FreshnessMark status={focus.freshnessStatus} />
          </div>
        </header>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted">{loadedAt ? `Last updated ${formatIstStamp(loadedAt)} IST` : ""}</p>
          {sample ? <SampleBadge /> : null}
        </div>
      )}
      {!focus ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {indices.map((row) => (
            <Link key={row.symbol} href={`/market?symbol=${encodeURIComponent(row.symbol)}`} className="card !p-3">
              <p className="text-xs font-semibold text-muted">{row.symbol}</p>
              <p className="num mt-1 font-bold text-ink">{formatPrice(row.last)}</p>
              <ChangeText last={row.last} changePct={row.changePct} size="xs" />
              <FreshnessMark status={row.freshnessStatus} />
            </Link>
          ))}
        </div>
      ) : null}
      {payload && closes.length > 1 ? (
        <section className="card">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {RANGES.map((item) => (
                <FilterChip key={item.id} active={range === item.id} onClick={() => setRange(item.id)}>{item.id}</FilterChip>
              ))}
            </div>
            <span className="text-[11px] text-muted">Close</span>
          </div>
          <AreaChart values={closes} />
          <p className="mt-2 text-[11px] text-muted">
            Chart summary: {focus ? `${focus.symbol} ${focus.changePct >= 0 ? "up" : "down"} ${Math.abs(focus.changePct).toFixed(2)}% in this view.` : payload.chartSymbol} {sample ? "Sample closes, not a live chart." : ""}
          </p>
        </section>
      ) : null}
      {payload && closes.length <= 1 ? <EmptyState title="No chart" body="No chart is available for this symbol yet." /> : null}
      {focus ? (
        <div className="flex gap-2">
          <button type="button" className="btn-primary flex-1" onClick={() => void addWatch()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add to watchlist
          </button>
          <Link href="/tips/alerts" className="btn-secondary">
            <Bell className="h-4 w-4" aria-hidden="true" />
            Alert
          </Link>
        </div>
      ) : null}
      {watchNote ? <p className="text-sm text-muted" role="status">{watchNote}</p> : null}
      <div className="grid grid-cols-2 rounded-[10px] border border-line bg-white p-0.5 text-sm font-semibold">
        <button type="button" className={`h-9 rounded-lg ${board === "gainers" ? "bg-primary text-white" : "text-muted"}`} onClick={() => setBoard("gainers")}>Up</button>
        <button type="button" className={`h-9 rounded-lg ${board === "losers" ? "bg-primary text-white" : "text-muted"}`} onClick={() => setBoard("losers")}>Down</button>
      </div>
      {movers.length === 0 ? <p className="text-sm text-muted">No names in this list.</p> : null}
      <ul className="card divide-y divide-line !p-0">
        {movers.map((row) => (
          <li key={row.symbol}>
            <Link href={`/market?symbol=${encodeURIComponent(row.symbol)}`} className="flex items-center justify-between gap-3 px-3.5 py-3">
              <span className="font-bold text-ink">{row.symbol}</span>
              <span className="text-right">
                <span className="num block text-[13px] font-semibold text-ink">{formatPrice(row.last)}</span>
                <ChangeText last={row.last} changePct={row.changePct} size="xs" />
                <FreshnessMark status={row.freshnessStatus} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
