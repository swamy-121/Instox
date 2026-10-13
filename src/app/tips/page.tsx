"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Filter, Search } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { FilterChip } from "@/components/design";
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
  const [query, setQuery] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
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

  const visible = tips?.filter((tip) => matchesGroup(tip, group) && matchesDuration(tip, duration) && (!freeOnly || tip.accessTier === "free") && tip.symbol.toLowerCase().includes(query.trim().toLowerCase())) ?? [];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <label className="flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-line bg-white px-3 text-[13px] text-muted">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Search symbol</span>
          <input value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} placeholder="Search symbol" className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted" />
        </label>
        <Link href="/tip-check" className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-line bg-white" aria-label="Check a stock">
          <Filter className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {GROUPS.map((item) => (
          <FilterChip key={item.id} active={group === item.id} onClick={() => setGroup(item.id)}>{item.label}</FilterChip>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {DURATIONS.map((item) => (
          <FilterChip key={item.id} active={duration === item.id} onClick={() => setDuration(item.id)}>{item.label}</FilterChip>
        ))}
        <FilterChip active={freeOnly} onClick={() => setFreeOnly((value) => !value)}>Free only</FilterChip>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          ["/tips/recommended", "For you"],
          ["/tips/saved", "Saved"],
          ["/tips/tracked", "Tracked"],
          ["/tips/alerts", "Alerts"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="text-[12.5px] font-semibold text-primary">{label}</Link>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted">{tips ? `${visible.length} tips · sorted by latest` : "Loading tips"}</p>
      </div>
      {error?.code === "FORBIDDEN" || error?.code === "ACCOUNT_DISABLED" ? <PermissionDenied message={error.message} /> : null}
      {error && error.code !== "FORBIDDEN" && error.code !== "ACCOUNT_DISABLED" ? (
        <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />
      ) : null}
      {!tips && !error ? <LoadingState label="Loading tips" /> : null}
      {tips && !error && visible.length === 0 ? <EmptyState title="No tips match" body="Try another category, or check back soon for new ideas." /> : null}
      <div className="space-y-3">
        {visible.map((tip) => <TipCard key={tip.id} tip={tip} quote={quotes.get(tip.symbol) ?? null} />)}
      </div>
    </div>
  );
}
