"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ChangeText, SampleBadge } from "@/components/design";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";
import { isSampleData } from "@/lib/market-session";
import { formatPrice } from "@/lib/money";

type Item = { id: string; symbol: string };
type Quote = { symbol: string; last: number; changePct: number; freshnessStatus?: string; dataLabel?: string };

export default function WatchlistPage() {
  return (
    <AppFrame requireAuth>
      <Body />
    </AppFrame>
  );
}

function Body() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("");

  function load() {
    setError(null);
    Promise.all([
      apiFetch<{ items: Item[] }>("/api/v1/watchlist"),
      apiFetch<{ records: Quote[] }>("/api/v1/content/indices"),
    ]).then(([list, market]) => {
      if (!list.ok) {
        setError(list.message);
        return;
      }
      setItems(list.data.items);
      if (market.ok) setQuotes(market.data.records);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const result = await apiFetch("/api/v1/watchlist", { method: "POST", body: JSON.stringify({ symbol }) });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSymbol("");
    load();
  }

  async function remove(value: string) {
    const result = await apiFetch(`/api/v1/watchlist?symbol=${encodeURIComponent(value)}`, { method: "DELETE" });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    load();
  }

  const bySymbol = new Map(quotes.map((row) => [row.symbol, row]));

  const sample = quotes.some((row) => isSampleData(row.dataLabel, row.freshnessStatus === "live" ? true : false));

  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(event) => void add(event)}>
        <input className="field" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} placeholder="Add a symbol" aria-label="Symbol" />
        <button className="btn-primary shrink-0" type="submit">Add</button>
      </form>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted">{items ? `${items.length} saved` : ""}</p>
        {sample ? <SampleBadge /> : null}
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!items && !error ? <LoadingState label="Loading watchlist" /> : null}
      {items && items.length === 0 ? <EmptyState title="Nothing saved" body="Add a stock from any idea, or type one above." /> : null}
      <ul className="card divide-y divide-line !p-0">
        {items?.map((item) => {
          const quote = bySymbol.get(item.symbol);
          return (
            <li key={item.id} className="flex items-center gap-3 px-3.5 py-3">
              <Link href={`/market?symbol=${encodeURIComponent(item.symbol)}`} className="min-w-0 flex-1">
                <span className="block font-bold text-ink">{item.symbol}</span>
                <span className="text-[11px] text-muted">NSE</span>
              </Link>
              {quote ? (
                <span className="text-right">
                  <span className="num block text-[13px] font-semibold text-ink">{formatPrice(quote.last)}</span>
                  <ChangeText last={quote.last} changePct={quote.changePct} size="xs" />
                </span>
              ) : <span className="text-[11px] text-muted">Price unavailable</span>}
              <button type="button" className="text-sm font-semibold text-loss" onClick={() => void remove(item.symbol)}>Remove</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
