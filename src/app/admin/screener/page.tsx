"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { OperationsGate } from "@/components/operations-gate";
import { ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Flags = { rsi: boolean; ema: boolean; cpr: boolean; atr: boolean; supertrend: boolean };

export default function AdminScreenerPage() {
  return (
    <AppFrame admin>
      <OperationsGate>
        <Body />
      </OperationsGate>
    </AppFrame>
  );
}

function Body() {
  const [flags, setFlags] = useState<Flags | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    apiFetch<{ flags: Flags }>("/api/v1/admin/screener").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setFlags(result.data.flags);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!flags) return;
    const result = await apiFetch("/api/v1/admin/screener", {
      method: "PATCH",
      body: JSON.stringify({ ...flags, reason }),
    });
    setMessage(result.ok ? "Screener flags saved." : result.message);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Screener flags</h1>
        <p className="text-sm text-muted">ADM-07. ATR and SuperTrend default to off.</p>
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!flags && !error ? <LoadingState /> : null}
      {flags ? (
        <form className="card space-y-2" onSubmit={(event) => void save(event)}>
          {(Object.keys(flags) as Array<keyof Flags>).map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={flags[key]}
                onChange={(event) => setFlags({ ...flags, [key]: event.target.checked })}
              />
              {key.toUpperCase()}
            </label>
          ))}
          <input className="field" placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          <button className="btn-primary" type="submit">Save flags</button>
          {message ? <p className="text-sm" role="status">{message}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
