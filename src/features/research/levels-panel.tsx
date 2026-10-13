"use client";

import { useState } from "react";
import { ErrorState, LoadingState } from "@/components/states";
import { SampleBadge } from "@/components/design";
import { isSampleData } from "@/lib/market-session";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/money";

type Level = { price: number; kind: "swing" | "pivot" };
type Payload = {
  symbol: string;
  price: number;
  supports: Level[];
  resistances: Level[];
  note: string;
  dataLabel: string;
  notice: string;
};

export function LevelsPanel() {
  const [symbol, setSymbol] = useState("RELIANCE");
  const [levels, setLevels] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    const result = await apiFetch<Payload>(`/api/v1/levels?symbol=${encodeURIComponent(symbol.trim())}`);
    setBusy(false);
    if (!result.ok) {
      setLevels(null);
      setError(result.message);
      return;
    }
    setLevels(result.data);
  }

  const ladder = levels
    ? [
        ...[...levels.resistances].reverse().map((level) => ({ ...level, role: "Resistance" as const })),
        { price: levels.price, kind: "pivot" as const, role: "Price" as const },
        ...levels.supports.map((level) => ({ ...level, role: "Support" as const })),
      ]
    : [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="sr-only">Support and resistance</h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
          Places where price turned, plus pivot levels from the previous bar. They can break. This is not a forecast.
        </p>
      </header>
      <form className="card flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={(event) => void run(event)}>
        <label className="block flex-1">
          <span className="label">Symbol</span>
          <input className="field" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} />
        </label>
        <button className="btn-primary w-full sm:w-auto" type="submit" disabled={busy}>{busy ? "Looking" : "Show levels"}</button>
      </form>
      {error ? <ErrorState message={error} /> : null}
      {busy && !levels ? <LoadingState label="Marking levels" /> : null}
      {levels ? (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-ink">{levels.symbol}</p>
            {isSampleData(levels.dataLabel) ? <SampleBadge /> : <span className="text-xs font-semibold text-muted">{levels.dataLabel}</span>}
          </div>
          <ol className="space-y-2">
            {ladder.map((level) => (
              <li
                key={`${level.role}-${level.price}`}
                className={`flex items-center justify-between rounded-xl px-3 py-3 text-sm ${level.role === "Price" ? "bg-primary text-white" : "bg-canvas text-ink"}`}
              >
                <span className="font-medium">{level.role}</span>
                <span className="tabular-nums">{formatPrice(level.price)}{level.role === "Price" ? "" : ` · ${level.kind}`}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm leading-6 text-muted">{levels.note} {levels.notice}</p>
        </section>
      ) : null}
    </div>
  );
}
