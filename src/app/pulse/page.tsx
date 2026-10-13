"use client";

import { useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ErrorState } from "@/components/states";
import { Chip, PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";

type PulseResponse = {
  symbol: string;
  dataLabel: string;
  live: boolean;
  notice: string;
  pulse: {
    version: string;
    score: number | null;
    limitations: string;
    missing: string[];
    renormalized: boolean;
    components: Array<{ id: string; score: number | null; note: string; weight: number }>;
  };
};

export default function PulsePage() {
  return (
    <AppFrame requireAuth>
      <PulseBody />
    </AppFrame>
  );
}

function PulseBody() {
  const [symbol, setSymbol] = useState("RELIANCE");
  const [result, setResult] = useState<PulseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await apiFetch<PulseResponse>(`/api/v1/pulse?symbol=${encodeURIComponent(symbol.trim())}`);
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
      <PageHeader title="Pulse score" lede="A mix of RSI, EMA distance and CPR. If some data is missing, we leave it out instead of counting it as zero." />
      <form className="card flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={(event) => void run(event)}>
        <label className="block flex-1">
          <span className="label">Symbol</span>
          <input className="field" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} />
        </label>
        <button className="btn-primary w-full sm:w-auto" type="submit" disabled={busy}>Calculate</button>
      </form>
      {error ? <ErrorState message={error} requestId={requestId} /> : null}
      {result ? (
        <section className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink">{result.dataLabel}</p>
            <Chip>Sample</Chip>
          </div>
          <p className="text-4xl font-semibold tabular-nums tracking-tight text-ink">{result.pulse.score === null ? "n/a" : result.pulse.score}</p>
          <p className="text-sm text-muted">{result.pulse.version}. {result.notice}</p>
          <ul className="space-y-2 text-sm">
            {result.pulse.components.map((component) => (
              <li key={component.id}>
                <span className="font-medium">{component.id}</span>
                <span className="text-muted"> · weight {component.weight} · {component.score === null ? "missing" : component.score}</span>
                <span className="mt-1 block text-xs text-muted">{component.note}</span>
              </li>
            ))}
          </ul>
          {result.pulse.renormalized ? <p className="text-xs text-muted">Some data was missing, so the score uses what's available.</p> : null}
          <p className="text-sm">{result.pulse.limitations}</p>
        </section>
      ) : null}
    </div>
  );
}
