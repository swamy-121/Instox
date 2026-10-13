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

type OptimizeRow = {
  emaPeriod: number;
  trades: number;
  gains: number;
  losses: number;
  netReturnPct: number | null;
  profitFactor: number | null;
};

type Optimize = {
  pickedPeriod: number | null;
  minTrades: number;
  note: string;
  dataLabel: string;
  rows: OptimizeRow[];
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
  const [optimize, setOptimize] = useState<Optimize | null>(null);
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

  async function compare() {
    setBusy(true);
    setError(null);
    const response = await apiFetch<Optimize>("/api/v1/backtests/optimize", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    });
    setBusy(false);
    if (!response.ok) {
      setOptimize(null);
      setError(response.message);
      setRequestId(response.requestId);
      return;
    }
    setOptimize(response.data);
  }

  return (
    <div className="space-y-4">
      <PageHeader embedded title="Backtest" lede="A practice EMA cross test on sample prices, with fees and slippage included. Losing trades are shown too. Past results don't predict future returns." />
      <form className="card flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={(event) => void run(event)}>
        <label className="block flex-1">
          <span className="label">Symbol</span>
          <input className="field" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} />
        </label>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button className="btn-primary w-full sm:w-auto" type="submit" disabled={busy}>Run hypothetical test</button>
          <button className="btn-secondary w-full sm:w-auto" type="button" disabled={busy} onClick={() => void compare()}>Compare settings</button>
        </div>
      </form>
      {optimize ? (
        <section className="card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-semibold text-ink">EMA lengths on this sample</h2>
            <Chip>Hypothetical</Chip>
          </div>
          <p className="text-sm leading-6 text-muted">{optimize.note} {optimize.dataLabel}.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 font-medium">EMA</th>
                  <th className="py-2 font-medium">Trades</th>
                  <th className="py-2 font-medium">Wins</th>
                  <th className="py-2 font-medium">Losses</th>
                  <th className="py-2 font-medium">Net</th>
                  <th className="py-2 font-medium">Factor</th>
                </tr>
              </thead>
              <tbody>
                {optimize.rows.map((row) => (
                  <tr key={row.emaPeriod} className={`border-t border-line ${row.emaPeriod === optimize.pickedPeriod ? "bg-primary-soft" : ""}`}>
                    <td className="py-2 font-medium tabular-nums">{row.emaPeriod}</td>
                    <td className="py-2 tabular-nums">{row.trades}</td>
                    <td className="py-2 tabular-nums">{row.gains}</td>
                    <td className="py-2 tabular-nums">{row.losses}</td>
                    <td className="py-2 tabular-nums">{row.netReturnPct === null ? "n/a" : `${row.netReturnPct}%`}</td>
                    <td className="py-2 tabular-nums">{row.profitFactor === null ? "n/a" : row.profitFactor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
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
