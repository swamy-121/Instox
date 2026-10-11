"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Chip, PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";

type Row = {
  symbol: string;
  dataLabel: string;
  live: boolean;
  indicators: { rsi: number | null; ema: number | null; cpr: { top: number; bottom: number } | null };
  matched: string[];
};

type Screen = {
  dataLabel: string;
  live: boolean;
  notice: string;
  results: Row[];
  skipped: { symbol: string; reason: string }[];
};

export default function ScreenerPage() {
  return (
    <AppFrame requireAuth>
      <ScreenerBody />
    </AppFrame>
  );
}

function ScreenerBody() {
  const [rsiLt, setRsiLt] = useState("");
  const [ema, setEma] = useState("");
  const [cpr, setCpr] = useState("");
  const [screen, setScreen] = useState<Screen | null>(null);
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
  }, []);

  function apply(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (rsiLt.trim()) params.set("rsiLt", rsiLt.trim());
    if (ema) params.set("ema", ema);
    if (cpr) params.set("cpr", cpr);
    const query = params.toString();
    load(query ? `?${query}` : "");
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Screener" lede="Filters combine with AND. ATR and SuperTrend stay off until an admin enables them." />
      <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-white px-4 py-3 text-sm shadow-card">
        <p className="text-ink">Sample data. These rows are not live quotes.</p>
        <Chip>Sample</Chip>
      </div>
      <form className="card grid gap-4 sm:grid-cols-3" onSubmit={apply}>
        <label>
          <span className="label">RSI below</span>
          <input className="field tabular-nums" inputMode="decimal" value={rsiLt} onChange={(event) => setRsiLt(event.target.value)} placeholder="40" />
        </label>
        <label>
          <span className="label">Price vs EMA</span>
          <select className="field" value={ema} onChange={(event) => setEma(event.target.value)}>
            <option value="">Any</option>
            <option value="above">Above EMA</option>
            <option value="below">Below EMA</option>
          </select>
        </label>
        <label>
          <span className="label">CPR</span>
          <select className="field" value={cpr} onChange={(event) => setCpr(event.target.value)}>
            <option value="">Any</option>
            <option value="above">Above top</option>
            <option value="inside">Inside</option>
            <option value="below">Below bottom</option>
          </select>
        </label>
        <div className="sm:col-span-3">
          <button className="btn-primary w-full sm:w-auto" type="submit">Run sample screen</button>
        </div>
      </form>
      {loading ? <LoadingState label="Running screener" /> : null}
      {error ? <ErrorState message={error} requestId={requestId} onRetry={() => load()} /> : null}
      {screen && screen.results.length === 0 ? (
        <EmptyState title="No matches" body="No eligible sample symbol passed every filter. Stale candles are left out." />
      ) : null}
      {screen && screen.results.length > 0 ? (
        <ul className="space-y-3">
          {screen.results.map((row) => (
            <li key={row.symbol} className="card">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-ink">{row.symbol}</h2>
                <Chip>Sample</Chip>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip>RSI {row.indicators.rsi === null ? "n/a" : row.indicators.rsi.toFixed(1)}</Chip>
                <Chip>EMA {row.indicators.ema === null ? "n/a" : row.indicators.ema.toFixed(2)}</Chip>
              </div>
              {row.matched.length > 0 ? <p className="mt-3 text-xs text-muted">Matched {row.matched.join(", ")}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {screen ? <p className="text-xs leading-5 text-muted">{screen.notice} Skipped {screen.skipped.length}.</p> : null}
    </div>
  );
}
