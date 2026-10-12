"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Chip } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/money";

type Quote = { symbol: string; name: string; last: number; changePct: number; kind: "index" | "stock" };
type Candle = { close: number; closeTime: string };
type Payload = { indices: Quote[]; chartSymbol: string; candles: Candle[]; dataLabel: string; live: boolean };

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

  const indices = payload?.indices.filter((row) => row.kind === "index") ?? [];
  const stocks = [...(payload?.indices.filter((row) => row.kind === "stock") ?? [])].sort((a, b) => b.changePct - a.changePct);
  const gainers = stocks.filter((row) => row.changePct >= 0).slice(0, 4);
  const losers = [...stocks].reverse().filter((row) => row.changePct < 0).slice(0, 4);
  const closes = payload?.candles.map((candle) => candle.close) ?? [];
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const points = closes.map((close, index) => {
    const x = closes.length <= 1 ? 0 : (index / (closes.length - 1)) * 280;
    const y = 100 - ((close - min) / span) * 80;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold text-ink">Market overview</h1>
        {payload ? <Chip>{payload.live ? "Live" : payload.dataLabel}</Chip> : null}
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!payload && !error ? <LoadingState label="Loading market" /> : null}
      {payload && indices.length === 0 ? <EmptyState title="No market data" body="Add index rows before this overview can draw." /> : null}
      <div className="grid grid-cols-2 gap-3">
        {indices.map((row) => (
          <article key={row.symbol} className="card">
            <p className="text-xs text-muted">{row.name}</p>
            <p className="mt-1 font-semibold tabular-nums text-ink">{formatPrice(row.last)}</p>
            <p className={`text-sm tabular-nums ${row.changePct >= 0 ? "text-profit" : "text-loss"}`}>{row.changePct.toFixed(2)}%</p>
          </article>
        ))}
      </div>
      {payload && closes.length > 1 ? (
        <section className="card">
          <h2 className="text-sm font-semibold text-ink">{payload.chartSymbol}</h2>
          <svg viewBox="0 0 280 110" className="mt-3 h-36 w-full">
            <polyline fill="none" stroke="#027332" strokeWidth="2" points={points} />
          </svg>
        </section>
      ) : null}
      {payload && closes.length === 0 ? <EmptyState title="No chart" body="Store a candle series for the selected symbol." /> : null}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink">Top gainers</h2>
        {gainers.length === 0 ? <p className="text-sm text-muted">No gainers in the stored list.</p> : null}
        <ul className="space-y-2">{gainers.map((row) => <Mover key={row.symbol} row={row} />)}</ul>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink">Top losers</h2>
        {losers.length === 0 ? <p className="text-sm text-muted">No losers in the stored list.</p> : null}
        <ul className="space-y-2">{losers.map((row) => <Mover key={row.symbol} row={row} />)}</ul>
      </section>
    </div>
  );
}

function Mover({ row }: { row: Quote }) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-line bg-white px-3 py-2">
      <span className="font-medium text-ink">{row.symbol}</span>
      <span className="tabular-nums text-sm text-ink">{formatPrice(row.last)}</span>
      <span className={`tabular-nums text-sm ${row.changePct >= 0 ? "text-profit" : "text-loss"}`}>{row.changePct.toFixed(2)}%</span>
    </li>
  );
}
