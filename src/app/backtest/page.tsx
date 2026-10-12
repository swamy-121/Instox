"use client";

import { useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Trade = {
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  grossReturnPct: number;
  netReturnPct: number;
  outcome: string;
};

type Result = {
  symbol: string;
  label: string;
  hypothetical: boolean;
  dataLabel: string;
  live: boolean;
  version: string;
  feeBps: number;
  slippageBps: number;
  note: string;
  losses: number;
  gains: number;
  netReturnPct: number | null;
  trades: Trade[];
};

function outcomeTone(outcome: string) {
  if (outcome === "gain") return "text-profit";
  if (outcome === "loss") return "text-loss";
  return "text-ink";
}

export default function BacktestPage() {
  return (
    <AppFrame requireAuth>
      <BacktestBody />
    </AppFrame>
  );
}

function BacktestBody() {
  const [symbol, setSymbol] = useState("RELIANCE");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await apiFetch<Result>("/api/v1/backtests", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    });
    setBusy(false);
    if (!response.ok) {
      setResult(null);
      setError(response.message);
      setRequestId(response.requestId);
      return;
    }
    setResult(response.data);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Backtest</h1>
        <p className="mt-1 text-sm text-muted">Hypothetical EMA cross on sample candles. Fees and slippage come from config. Losing trades stay in the list.</p>
      </div>
      <form className="card flex flex-wrap items-end gap-3" onSubmit={(event) => void run(event)}>
        <label className="text-sm">
          <span className="label">Symbol</span>
          <input className="field" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} />
        </label>
        <button className="btn-primary" type="submit" disabled={busy}>Run hypothetical test</button>
      </form>
      {error ? <ErrorState message={error} requestId={requestId} /> : null}
      {result ? (
        <section className="space-y-3">
          <div className="card text-sm">
            <p className="font-semibold">{result.label}. {result.dataLabel}. Live: {result.live ? "yes" : "no"}.</p>
            <p className="mt-2">{result.note}</p>
            <p className="mt-2 text-muted">
              {result.version} · fee {result.feeBps} bps · slippage {result.slippageBps} bps · gains {result.gains} · losses {result.losses} · net{" "}
              {result.netReturnPct === null ? "n/a" : `${result.netReturnPct}%`}
            </p>
          </div>
          {result.trades.length === 0 ? (
            <EmptyState title="No closed trades" body="The sample series did not complete an EMA cross. That is not shown as a profit." />
          ) : (
            <ul className="space-y-2">
              {result.trades.map((trade) => (
                <li key={`${trade.entryTime}-${trade.exitTime}`} className="card text-sm">
                  <p className={`font-medium ${outcomeTone(trade.outcome)}`}>{trade.outcome}</p>
                  <p className="tabular-nums text-muted">
                    {trade.entryPrice} to {trade.exitPrice} · gross {trade.grossReturnPct}% · net{" "}
                    <span className={outcomeTone(trade.outcome)}>{trade.netReturnPct}%</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
