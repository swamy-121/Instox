"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { FilterChip, SampleBadge } from "@/components/design";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";
import { isSampleData } from "@/lib/market-session";
import { formatPrice } from "@/lib/money";

type Row = {
  symbol: string;
  segment: "equity" | "futures" | "options";
  last: number;
  indicators: { rsi: number | null; ema: number | null; cpr: { top: number; bottom: number } | null };
};

type Screen = {
  results: Row[];
  skipped: { symbol: string; reason: string }[];
  dataLabel?: string;
  live?: boolean;
  notice?: string;
};

type ConfidenceRow = {
  symbol: string;
  close: number;
  score: number;
  band: "stands out" | "mixed" | "weak";
  reasons: string[];
  rsi: number | null;
};

type ConfidenceScreen = {
  dataLabel: string;
  notice: string;
  rows: ConfidenceRow[];
  standout: number;
};

const TABS = [
  { id: "rsi", label: "RSI" },
  { id: "ema", label: "EMA" },
  { id: "cpr", label: "CPR" },
  { id: "fo", label: "F&O" },
  { id: "confidence", label: "High confidence" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ScreenerPage() {
  return (
    <AppFrame requireAuth>
      <ScreenerBody />
    </AppFrame>
  );
}

function ScreenerBody() {
  const [view, setView] = useState<"prebuilt" | "custom" | "saved">("prebuilt");
  const [tab, setTab] = useState<TabId>("rsi");
  const [rsiLt, setRsiLt] = useState("");
  const [screen, setScreen] = useState<Screen | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceScreen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  function load(params = "") {
    setLoading(true);
    setError(null);
    apiFetch<Screen>(`/api/v1/screener${params}`).then((result) => {
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
    apiFetch<ConfidenceScreen>("/api/v1/screener/bhavcopy").then((result) => {
      if (result.ok) setConfidence(result.data);
    });
  }, []);

  function apply(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (rsiLt.trim()) params.set("rsiLt", rsiLt.trim());
    if (tab === "ema") params.set("ema", "above");
    if (tab === "cpr") params.set("cpr", "above");
    const query = params.toString();
    load(query ? `?${query}` : "");
  }

  const rows = (screen?.results ?? []).filter((row) => (tab === "fo" ? row.segment !== "equity" : true));
  const sample = isSampleData(view === "saved" ? confidence?.dataLabel : screen?.dataLabel, view === "saved" ? false : screen?.live);

  return (
    <div className="space-y-3">
      <p className="max-w-xl text-sm leading-6 text-muted">
        Indicator scans, plus a high-confidence reading from daily bars. A high score means the checks line up. It is not a chance of profit.
      </p>
      <div className="grid grid-cols-3 rounded-[10px] border border-line bg-white p-0.5 text-[13px] font-semibold" role="tablist">
        {([
          ["prebuilt", "Prebuilt"],
          ["custom", "Custom"],
          ["saved", "Saved"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={`h-9 rounded-lg ${view === id ? "bg-primary text-white" : "text-muted"}`}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "prebuilt" ? (
        <div className="flex gap-2 overflow-x-auto">
          {TABS.filter((item) => item.id !== "confidence").map((item) => (
            <button key={item.id} type="button" className={`card min-w-[150px] shrink-0 !p-3 text-left ${tab === item.id ? "border-[#9FD1B3] bg-[#F3FAF6]" : ""}`} onClick={() => { setTab(item.id); setRsiLt(""); const params = new URLSearchParams(); if (item.id === "ema") params.set("ema", "above"); if (item.id === "cpr") params.set("cpr", "above"); const query = params.toString(); load(query ? `?${query}` : ""); }}>
              <span className="block text-[13px] font-bold">{item.label}</span>
              <span className="text-[11px] text-muted">{item.id === "rsi" ? "Relative strength" : item.id === "ema" ? "Above the average" : item.id === "cpr" ? "Above the pivot" : "Futures and options"}</span>
            </button>
          ))}
        </div>
      ) : null}
      {view === "saved" ? (
        <>
          <EmptyState title="No saved screeners" body="Saving a custom screener is not available yet. The high-confidence reading below uses the daily bars already stored." />
          <ConfidenceList screen={confidence} />
        </>
      ) : null}
      {view === "custom" ? (
      <form className="flex flex-wrap items-end gap-2" onSubmit={apply}>
        <label className="min-w-0 flex-1">
          <span className="label">RSI below</span>
          <input className="field tabular-nums" inputMode="decimal" value={rsiLt} onChange={(event) => setRsiLt(event.target.value)} placeholder="40" />
        </label>
        <button className="btn-quiet" type="button" onClick={() => { setRsiLt(""); setTab("rsi"); load(); }}>Reset</button>
        <button className="btn-primary shrink-0" type="submit">Apply</button>
      </form>
      ) : null}
      {view !== "saved" ? (
      <>
      <div className="flex flex-wrap gap-2">
        {tab !== "rsi" ? <FilterChip active onClick={() => { setTab("rsi"); load(); }}>{tab.toUpperCase()} on</FilterChip> : null}
        {rsiLt ? <FilterChip active onClick={() => { setRsiLt(""); load(); }}>RSI below {rsiLt}</FilterChip> : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted">{screen ? `${rows.length} matches${screen.notice ? ` · ${screen.notice}` : ""}` : "Running screener"}</p>
        {sample ? <SampleBadge /> : null}
      </div>
      {loading ? <LoadingState label="Running screener" /> : null}
      {error ? <ErrorState message={error} requestId={requestId} onRetry={() => load()} /> : null}
      {screen && rows.length === 0 ? <EmptyState title="No matches" body="No symbol passed this scan. Clear a filter or try another preset." /> : null}
      {rows.length > 0 ? (
        <>
          <ul className="card divide-y divide-line !p-0 lg:hidden">
            {rows.map((row) => (
              <li key={row.symbol}>
                <Link href={`/market?symbol=${encodeURIComponent(row.symbol)}`} className="flex items-center justify-between gap-3 px-3.5 py-3">
                  <span>
                    <span className="block text-[13px] font-bold text-ink">{row.symbol}</span>
                    <span className="text-[11px] text-muted">{metric(row, tab)}</span>
                  </span>
                  <span className="num text-[13px] font-semibold text-ink">{formatPrice(row.last)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="card hidden overflow-x-auto p-0 lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAFBFA] text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3.5 py-2.5 font-semibold">Symbol</th>
                  <th className="px-3.5 py-2.5 font-semibold">Matched</th>
                  <th className="px-3.5 py-2.5 text-right font-semibold">Price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.symbol} className="border-t border-line">
                    <td className="px-3.5 py-3 font-bold text-ink">
                      <Link href={`/market?symbol=${encodeURIComponent(row.symbol)}`}>{row.symbol}</Link>
                    </td>
                    <td className="px-3.5 py-3 text-muted">{metric(row, tab)}</td>
                    <td className="num px-3.5 py-3 text-right font-semibold text-ink">{formatPrice(row.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      </>
      ) : null}
    </div>
  );
}

function ConfidenceList({ screen }: { screen: ConfidenceScreen | null }) {
  if (!screen) return <LoadingState label="Scoring daily bars" />;
  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-muted">
        {screen.dataLabel}. {screen.standout} name{screen.standout === 1 ? "" : "s"} stand out. {screen.notice}
      </p>
      {screen.rows.length === 0 ? <EmptyState title="Not enough bars" body="The high-confidence read needs about 50 sessions." /> : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {screen.rows.map((row) => (
          <li key={row.symbol} className="card space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{row.symbol}</p>
                <p className="text-sm tabular-nums text-muted">{formatPrice(row.close)} · RSI {row.rsi ?? "n/a"}</p>
              </div>
              <span className="text-right">
                <span className="block text-lg font-semibold tabular-nums text-ink">{row.score}</span>
                <span className="text-xs capitalize text-muted">{row.band}</span>
              </span>
            </div>
            <ul className="space-y-1 text-sm text-muted">
              {row.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </li>
        ))}
      </ul>
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
