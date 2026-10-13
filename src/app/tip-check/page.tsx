"use client";

import { useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ErrorState } from "@/components/states";
import { Chip, PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/money";

type Reading = {
  symbol: string;
  side: "BUY" | "SELL" | "WAIT";
  agreement: number;
  reasons: string[];
  stop: number | null;
  target: number | null;
  note: string;
  dataLabel: string;
  notice: string;
  used: number;
  limit: number;
  remaining: number;
};

export default function TipCheckPage() {
  return (
    <AppFrame requireAuth>
      <CheckBody />
    </AppFrame>
  );
}

function CheckBody() {
  const [symbol, setSymbol] = useState("RELIANCE");
  const [reading, setReading] = useState<Reading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await apiFetch<Reading>("/api/v1/tip-checks", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    });
    setBusy(false);
    if (!result.ok) {
      setReading(null);
      setError(result.message);
      return;
    }
    setReading(result.data);
  }

  const tone = reading?.side === "BUY" ? "profit" : reading?.side === "SELL" ? "loss" : "neutral";

  return (
    <div className="space-y-4">
      <PageHeader
        embedded
        title="Check a stock"
        lede="A reading of trend, momentum, and where price sits versus recent bars. The number is how many checks agree. It is not a chance of profit."
      />
      <form className="card flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={(event) => void run(event)}>
        <label className="block flex-1">
          <span className="label">Symbol</span>
          <input className="field" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} />
        </label>
        <button className="btn-primary w-full sm:w-auto" type="submit" disabled={busy}>{busy ? "Checking" : "Check"}</button>
      </form>
      {error ? <ErrorState message={error} /> : null}
      {reading ? (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted">{reading.symbol}</p>
              <p className="text-3xl font-semibold tracking-tight text-ink">{reading.side === "WAIT" ? "Wait" : reading.side}</p>
            </div>
            <Chip tone={tone}>{reading.agreement} in agreement</Chip>
          </div>
          <p className="text-sm text-muted">{reading.dataLabel}. {reading.used} of {reading.limit} checks used today. {reading.remaining} left.</p>
          <ul className="space-y-2 text-sm leading-6 text-ink">
            {reading.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
          {reading.stop !== null && reading.target !== null ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-canvas p-3">
                <p className="text-xs text-muted">Sketch stop</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{formatPrice(reading.stop)}</p>
              </div>
              <div className="rounded-xl bg-canvas p-3">
                <p className="text-xs text-muted">Sketch target</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{formatPrice(reading.target)}</p>
              </div>
            </div>
          ) : null}
          <p className="text-sm leading-6 text-muted">{reading.note} {reading.notice}</p>
        </section>
      ) : null}
    </div>
  );
}
