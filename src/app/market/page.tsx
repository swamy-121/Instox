"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { FreshnessMark } from "@/components/freshness-mark";
import { AreaChart, StockAvatar } from "@/components/illustrations";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { mergeDisplayed } from "@/features/market/live-quotes";
import { isLiveIndex } from "@/lib/live-indices";
import { useLiveQuotes } from "@/features/market/use-live-quotes";
import { apiFetch } from "@/lib/api-client";
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">Market overview</h1>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!payload && !error ? <LoadingState label="Loading market" /> : null}
      {payload && indices.length === 0 ? <EmptyState title="No market data" body="Add index rows before this overview can draw." /> : null}
      <div className="grid grid-cols-2 gap-3">
        {indices.map((row) => (
          <article key={row.symbol} className={`rounded-xl p-4 shadow-card ${row.changePct >= 0 ? "bg-[#E7F6EE]" : "bg-[#FDECEC]"}`}>
            <p className="text-xs font-semibold text-muted">{row.symbol}</p>
            <p className="mt-1 font-semibold tabular-nums text-ink">{formatPrice(row.last)}</p>
            <p className={`text-sm font-semibold tabular-nums ${row.changePct >= 0 ? "text-profit" : "text-loss"}`}>
              {row.changePct >= 0 ? "+" : ""}
              {row.changePct.toFixed(2)}%
            </p>
            <FreshnessMark status={row.freshnessStatus} />
          </article>
        ))}
      </div>
      {payload && closes.length > 1 ? (
        <section className="card">
          <h2 className="text-sm font-semibold text-ink">{payload.chartSymbol}</h2>
          <AreaChart values={closes} />
          <div className="mt-2 flex justify-between gap-1">
            {RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`flex-1 rounded-full py-1.5 text-xs font-semibold ${range === item.id ? "bg-primary text-white" : "text-muted"}`}
                onClick={() => setRange(item.id)}
              >
                {item.id}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {payload && closes.length <= 1 ? <EmptyState title="No chart" body="Store a candle series for the selected symbol." /> : null}
      <div className="grid grid-cols-2 rounded-full bg-canvas p-1 text-sm font-medium">
        <button type="button" className={`h-10 rounded-full ${board === "gainers" ? "bg-primary text-white" : "text-ink"}`} onClick={() => setBoard("gainers")}>Top gainers</button>
        <button type="button" className={`h-10 rounded-full ${board === "losers" ? "bg-primary text-white" : "text-ink"}`} onClick={() => setBoard("losers")}>Top losers</button>
      </div>
      {movers.length === 0 ? <p className="text-sm text-muted">No names in this list.</p> : null}
      <ul className="space-y-2">
        {movers.map((row) => (
          <li key={row.symbol} className="card flex items-center gap-3 py-3">
            <StockAvatar symbol={row.symbol} className="h-10 w-10 text-[10px]" />
            <span className="flex-1 font-semibold text-ink">{row.symbol}</span>
            <span className="tabular-nums text-sm text-ink">{formatPrice(row.last)}</span>
            <span className={`tabular-nums text-sm font-semibold ${row.changePct >= 0 ? "text-profit" : "text-loss"}`}>
              {row.changePct >= 0 ? "+" : ""}
              {row.changePct.toFixed(2)}%
            </span>
            <FreshnessMark status={row.freshnessStatus} />
          </li>
        ))}
      </ul>
    </div>
  );
}
