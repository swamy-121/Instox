"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { TipCard, type TipQuote } from "@/components/tip-card";
import { apiFetch } from "@/lib/api-client";
import type { TipView } from "@/server/tips/present";

type Feed = { tips: TipView[]; viewerTier: string };

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

function matchesGroup(tip: TipView, group: (typeof GROUPS)[number]["id"]): boolean {
  if (group === "all") return true;
  if (group === "equity") return tip.category === "equity";
  if (group === "options") return tip.category === "options";
  return tip.category === "futures" || tip.category === "options";
}

function matchesDuration(tip: TipView, duration: (typeof DURATIONS)[number]["id"]): boolean {
  if (duration === "all") return true;
  if (tip.category === duration) return true;
  const frame = tip.timeframe.toLowerCase();
  if (duration === "intraday") return frame.includes("same session");
  if (duration === "short_term") return frame.includes("week");
  return false;
}

export default function TipsPage() {
  return (
    <AppFrame>
      <TipsBody />
    </AppFrame>
  );
}

function TipsBody() {
  const [group, setGroup] = useState<(typeof GROUPS)[number]["id"]>("all");
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]["id"]>("all");
  const [tips, setTips] = useState<TipView[] | null>(null);
  const [quotes, setQuotes] = useState<Map<string, TipQuote>>(new Map());
  const [error, setError] = useState<{ message: string; code: string; requestId?: string } | null>(null);

  function load() {
    setError(null);
    Promise.all([
      apiFetch<Feed>("/api/v1/tips?limit=20"),
      apiFetch<{ records: Array<TipQuote & { symbol: string }> }>("/api/v1/content/indices"),
    ]).then(([feed, market]) => {
      if (!feed.ok) {
        setError({ message: feed.message, code: feed.code, requestId: feed.requestId });
        return;
      }
      setTips(feed.data.tips);
      if (market.ok) setQuotes(new Map(market.data.records.map((row) => [row.symbol, row])));
    });
  }

  useEffect(() => {
    load();
  }, []);

  const visible = tips?.filter((tip) => matchesGroup(tip, group) && matchesDuration(tip, duration)) ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-ink">Trading ideas</h1>
      <div className="flex gap-2 overflow-x-auto">
        {GROUPS.map((item) => (
          <button key={item.id} type="button" className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${group === item.id ? "bg-primary text-white" : "border border-line bg-white text-ink"}`} onClick={() => setGroup(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {DURATIONS.map((item) => (
          <button key={item.id} type="button" className={`shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium ${duration === item.id ? "border-primary bg-primary text-white" : "border-line bg-white text-ink"}`} onClick={() => setDuration(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {error?.code === "FORBIDDEN" || error?.code === "ACCOUNT_DISABLED" ? <PermissionDenied message={error.message} /> : null}
      {error && error.code !== "FORBIDDEN" && error.code !== "ACCOUNT_DISABLED" ? (
        <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />
      ) : null}
      {!tips && !error ? <LoadingState label="Loading tips" /> : null}
      {tips && !error && visible.length === 0 ? <EmptyState title="No tips match" body="Try another category, or check back after a tip is published." /> : null}
      <div className="space-y-3">
        {visible.map((tip) => <TipCard key={tip.id} tip={tip} quote={quotes.get(tip.symbol) ?? null} />)}
      </div>
    </div>
  );
}
