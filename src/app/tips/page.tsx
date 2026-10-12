"use client";

import { Suspense, useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ListBar, ListPager, useListQuery } from "@/components/list-bar";
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { TipCard, type TipQuote } from "@/components/tip-card";
import { apiFetch } from "@/lib/api-client";
import type { TipView } from "@/server/tips/present";

type Feed = { tips: TipView[]; total: number; page: number; pageSize: number; viewerTier: string };

const GROUPS = [
  { id: "all", label: "All" },
  { id: "equity", label: "Equity" },
  { id: "fo", label: "F&O" },
  { id: "options", label: "Options" },
] as const;

const DURATIONS = [
  { id: "all", label: "All" },
  { id: "short_term", label: "Short term" },
  { id: "intraday", label: "Intraday" },
  { id: "btst", label: "BTST" },
] as const;

export default function TipsPage() {
  return (
    <AppFrame>
      <Suspense fallback={<LoadingState label="Loading tips" />}>
        <TipsBody />
      </Suspense>
    </AppFrame>
  );
}

function TipsBody() {
  const list = useListQuery();
  const segment = list.search.get("segment") ?? "all";
  const duration = list.search.get("duration") ?? "all";
  const [tips, setTips] = useState<TipView[] | null>(null);
  const [total, setTotal] = useState(0);
  const [quotes, setQuotes] = useState<Map<string, TipQuote>>(new Map());
  const [error, setError] = useState<{ message: string; code: string; requestId?: string } | null>(null);

  function load() {
    setError(null);
    Promise.all([
      apiFetch<Feed>(`/api/v1/tips?${list.queryString(["segment", "duration", "side", "q", "from", "to"])}`),
      apiFetch<{ records: Array<TipQuote & { symbol: string }> }>("/api/v1/content/indices"),
    ]).then(([feed, market]) => {
      if (!feed.ok) {
        setError({ message: feed.message, code: feed.code, requestId: feed.requestId });
        return;
      }
      setTips(feed.data.tips);
      setTotal(feed.data.total);
      if (market.ok) setQuotes(new Map(market.data.records.map((row) => [row.symbol, row])));
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.search]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-ink">Trading ideas</h1>
      <div className="flex gap-2 overflow-x-auto">
        {GROUPS.map((item) => (
          <button key={item.id} type="button" className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${segment === item.id ? "bg-primary text-white" : "border border-line bg-white text-ink"}`} onClick={() => list.set({ segment: item.id === "all" ? null : item.id })}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {DURATIONS.map((item) => (
          <button key={item.id} type="button" className={`shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium ${duration === item.id ? "border-primary bg-primary text-white" : "border-line bg-white text-ink"}`} onClick={() => list.set({ duration: item.id === "all" ? null : item.id })}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label>
          <span className="label">Side</span>
          <select className="field w-32" value={list.search.get("side") ?? ""} aria-label="Side" onChange={(event) => list.set({ side: event.target.value })}>
            <option value="">Any</option>
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </select>
        </label>
        <div className="min-w-[12rem] flex-1">
          <ListBar placeholder="Symbol" showDates />
        </div>
      </div>
      {error?.code === "FORBIDDEN" || error?.code === "ACCOUNT_DISABLED" ? <PermissionDenied message={error.message} /> : null}
      {error && error.code !== "FORBIDDEN" && error.code !== "ACCOUNT_DISABLED" ? (
        <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />
      ) : null}
      {!tips && !error ? <LoadingState label="Loading tips" /> : null}
      {tips && !error && tips.length === 0 ? <EmptyState title="No tips match" body="Try another symbol or category, or check back after a tip is published." /> : null}
      <div className="space-y-3">
        {tips?.map((tip) => <TipCard key={tip.id} tip={tip} quote={quotes.get(tip.symbol) ?? null} />)}
      </div>
      {tips ? <ListPager total={total} page={list.page} pageSize={list.pageSize} /> : null}
    </div>
  );
}
