"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { StockAvatar } from "@/components/illustrations";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/money";

type Item = { id: string; symbol: string };
type Quote = { symbol: string; last: number; changePct: number };

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
      apiFetch<{ indices: Quote[] }>("/api/v1/market/overview"),
    ]).then(([list, market]) => {
      if (!list.ok) {
        setError(list.message);
        return;
      }
      setItems(list.data.items);
      if (market.ok) setQuotes(market.data.indices);
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">Watchlist</h1>
      <form className="flex gap-2" onSubmit={(event) => void add(event)}>
        <input className="field" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} placeholder="Symbol" aria-label="Symbol" />
        <button className="btn-primary shrink-0" type="submit">Add symbol</button>
      </form>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!items && !error ? <LoadingState label="Loading watchlist" /> : null}
      {items && items.length === 0 ? <EmptyState title="Nothing saved" body="Add a symbol from a tip or type one above." /> : null}
      <ul className="space-y-2">
        {items?.map((item) => {
          const quote = bySymbol.get(item.symbol);
          return (
            <li key={item.id} className="card flex items-center gap-3">
              <StockAvatar symbol={item.symbol} className="h-10 w-10 text-[10px]" />
              <Link href={`/market?symbol=${item.symbol}`} className="flex-1 font-semibold text-ink">{item.symbol}</Link>
              {quote ? (
                <span className="text-sm tabular-nums text-ink">
                  {formatPrice(quote.last)}{" "}
                  <span className={quote.changePct >= 0 ? "text-profit" : "text-loss"}>{quote.changePct.toFixed(2)}%</span>
                </span>
              ) : null}
              <button type="button" className="text-sm text-muted" onClick={() => void remove(item.symbol)}>Remove</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
