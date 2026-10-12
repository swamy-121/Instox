"use client";

import { Suspense, useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { StockAvatar } from "@/components/illustrations";
import { Chip, ChipRow, ListPager, ListToolbar, useListQuery } from "@/components/list-bar";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/money";

type Row = {
  symbol: string;
  segment: "equity" | "futures" | "options";
  last: number;
  indicators: { rsi: number | null; ema: number | null; cpr: { top: number; bottom: number } | null };
};

type Screen = {
  results: Row[];
  total: number;
  skipped: { symbol: string; reason: string }[];
};

const TABS = [
  { id: "rsi", label: "RSI" },
  { id: "ema", label: "EMA" },
  { id: "cpr", label: "CPR" },
  { id: "fo", label: "F&O" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ScreenerPage() {
  return (
    <AppFrame requireAuth>
      <Suspense fallback={<LoadingState label="Running screener" />}>
        <ScreenerBody />
      </Suspense>
    </AppFrame>
  );
}

function ScreenerBody() {
  const list = useListQuery();
  const tab = (list.search.get("tab") ?? "rsi") as TabId;
  const [screen, setScreen] = useState<Screen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams(list.queryString(["q", "page", "pageSize"]));
    const rsiLt = list.search.get("rsiLt");
    if (rsiLt) params.set("rsiLt", rsiLt);
    if (tab === "ema") params.set("ema", "above");
    if (tab === "cpr") params.set("cpr", "above");
    if (tab === "fo") params.set("segment", "fo");
    apiFetch<Screen>(`/api/v1/screener?${params.toString()}`).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        setRequestId(result.requestId);
        setScreen(null);
        return;
      }
      setScreen(result.data);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.search]);

  const rows = screen?.results ?? [];

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-ink">Screener</h1>
      <ChipRow label="Scan">
        {TABS.map((item) => (
          <Chip key={item.id} active={tab === item.id} onClick={() => list.set({ tab: item.id })}>
            {item.label}
          </Chip>
        ))}
      </ChipRow>
      <ListToolbar placeholder="Symbol" filters={[{ kind: "text", name: "rsiLt", label: "RSI below", placeholder: "40" }]} />
      {loading ? <LoadingState label="Running screener" /> : null}
      {error ? <ErrorState message={error} requestId={requestId} onRetry={() => load()} /> : null}
      {screen && rows.length === 0 ? <EmptyState title="No matches" body="No symbol passed this scan." /> : null}
      {rows.length > 0 ? (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Symbol</th>
                <th className="px-4 py-3 font-medium">LTP</th>
                <th className="px-4 py-3 font-medium">{tab === "ema" ? "EMA" : tab === "cpr" ? "CPR" : "RSI"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.symbol} className="border-t border-line">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      <StockAvatar symbol={row.symbol} className="h-8 w-8 text-[10px]" />
                      {row.symbol}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink">{formatPrice(row.last)}</td>
                  <td className="px-4 py-3 tabular-nums text-ink">{metric(row, tab)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {screen && !loading && !error ? <ListPager total={screen.total} page={list.page} pageSize={list.pageSize} /> : null}
    </div>
  );
}

function metric(row: Row, tab: TabId): string {
  if (tab === "ema") return row.indicators.ema === null ? "-" : row.indicators.ema.toFixed(2);
  if (tab === "cpr") {
    if (!row.indicators.cpr) return "-";
    return `${row.indicators.cpr.bottom.toFixed(1)} to ${row.indicators.cpr.top.toFixed(1)}`;
  }
  return row.indicators.rsi === null ? "-" : row.indicators.rsi.toFixed(1);
}
