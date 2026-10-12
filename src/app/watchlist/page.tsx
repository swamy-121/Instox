"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { FreshnessMark } from "@/components/freshness-mark";
import { StockAvatar } from "@/components/illustrations";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { shownQuote } from "@/features/market/live-quotes";
import { useLiveQuotes } from "@/features/market/use-live-quotes";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/money";

type Item = { id: string; symbol: string };
type Quote = { symbol: string; last: number; changePct: number; freshnessStatus?: string };

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
  const [feedId, setFeedId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const live = useLiveQuotes(feedId);
  const [symbol, setSymbol] = useState("");

  function load() {
    setError(null);
    Promise.all([
      apiFetch<{ items: Item[] }>("/api/v1/watchlist"),
      apiFetch<{ indices: Quote[]; feed?: string }>("/api/v1/market/overview"),
    ]).then(([list, market]) => {
      if (!list.ok) {
        setError(list.message);
        return;
      }
      setItems(list.data.items);
      if (market.ok) {
        setFeedId(market.data.feed);
        setQuotes(market.data.indices);
      }
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
          const quote = shownQuote(bySymbol.get(item.symbol), live.quotes.get(item.symbol), feedId, live.streamDown);
          const price = quote && Number.isFinite(quote.last) && Number.isFinite(quote.changePct) ? quote : null;
          return (
            <li key={item.id} className="card flex items-center gap-3">
              <StockAvatar symbol={item.symbol} className="h-10 w-10 text-[10px]" />
              <Link href={`/market?symbol=${item.symbol}`} className="flex-1 font-semibold text-ink">{item.symbol}</Link>
              {price ? (
                <span className="text-right text-sm tabular-nums text-ink">
                  {formatPrice(price.last)}{" "}
                  <span className={price.changePct >= 0 ? "text-profit" : "text-loss"}>{price.changePct.toFixed(2)}%</span>
                  <FreshnessMark status={price.freshnessStatus} />
                </span>
              ) : quote?.freshnessStatus === "offline" ? (
                <FreshnessMark status="offline" />
              ) : null}
              <button type="button" className="text-sm text-muted" onClick={() => void remove(item.symbol)}>Remove</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
