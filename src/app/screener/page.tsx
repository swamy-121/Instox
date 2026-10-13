"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { StockAvatar } from "@/components/illustrations";
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
  skipped: { symbol: string; reason: string }[];
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

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Screener</h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
          Indicator scans, plus a high-confidence reading from daily bars. A high score means the checks line up. It is not a chance of profit.
        </p>
      </header>
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${tab === item.id ? "bg-primary text-white" : "bg-primary-soft text-primary"}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "confidence" ? (
        <ConfidenceList screen={confidence} />
      ) : null}
      {tab !== "confidence" ? (
      <>
      <form className="flex items-end gap-2" onSubmit={apply}>
        <label className="min-w-0 flex-1">
          <span className="label">RSI below</span>
          <input className="field tabular-nums" inputMode="decimal" value={rsiLt} onChange={(event) => setRsiLt(event.target.value)} placeholder="40" />
        </label>
        <button className="btn-primary shrink-0" type="submit">Run screener</button>
      </form>
      {loading ? <LoadingState label="Running screener" /> : null}
      {error ? <ErrorState message={error} requestId={requestId} onRetry={() => load()} /> : null}
      {screen && rows.length === 0 ? <EmptyState title="No matches" body="No symbol passed this scan." /> : null}
      {rows.length > 0 ? (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
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
