"use client";

import { useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState } from "@/components/states";
import { Chip, PageHeader } from "@/components/ui";
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
      <PageHeader title="Backtest" lede="A practice EMA cross test on sample prices, with fees and slippage included. Losing trades are shown too. Past results don't predict future returns." />
      <form className="card flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={(event) => void run(event)}>
        <label className="block flex-1">
          <span className="label">Symbol</span>
          <input className="field" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} />
        </label>
        <button className="btn-primary w-full sm:w-auto" type="submit" disabled={busy}>Run hypothetical test</button>
      </form>
      {error ? <ErrorState message={error} requestId={requestId} /> : null}
      {result ? (
        <section className="space-y-3">
          <div className="card text-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-ink">{result.label}. {result.dataLabel}.</p>
              <Chip>Hypothetical</Chip>
            </div>
            <p className="mt-2">{result.note}</p>
            <p className="mt-2 text-muted">
              {result.version} · fee {result.feeBps} bps · slippage {result.slippageBps} bps · gains {result.gains} · losses {result.losses} · net{" "}
              {result.netReturnPct === null ? "n/a" : `${result.netReturnPct}%`}
            </p>
          </div>
          {result.trades.length === 0 ? (
            <EmptyState title="No closed trades" body="No EMA cross happened in this sample, so there's no result to show." />
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
