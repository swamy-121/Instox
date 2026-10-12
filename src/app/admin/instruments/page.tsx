"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { OperationsGate } from "@/components/operations-gate";
import { ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Instrument = {
  symbol: string;
  segment: string;
  tickSize: number;
  isEligible: boolean;
  eligibilitySource: string;
  dataLabel: string;
};

export default function AdminInstrumentsPage() {
  return (
    <AppFrame admin>
      <OperationsGate>
        <Body />
      </OperationsGate>
    </AppFrame>
  );
}

function Body() {
  const [rows, setRows] = useState<Instrument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("");
  const [segment, setSegment] = useState("equity");
  const [tickSize, setTickSize] = useState("0.05");
  const [source, setSource] = useState("manual_unlicensed");
  const [effectiveFrom, setEffectiveFrom] = useState("2026-10-11");
  const [reason, setReason] = useState("");

  function load() {
    apiFetch<{ instruments: Instrument[] }>("/api/v1/admin/instruments").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setRows(result.data.instruments);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const result = await apiFetch("/api/v1/admin/instruments", {
      method: "POST",
      body: JSON.stringify({
        symbol,
        segment,
        tickSize: Number(tickSize),
        eligibilitySource: source,
        effectiveFrom,
        reason,
      }),
    });
    setMessage(result.ok ? "Instrument saved. The row stays labeled as sample data." : result.message);
    if (result.ok) load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Instruments</h1>
        <p className="text-sm text-muted">ADM-06. Imports cannot be labeled live, and a licensed source needs MARKET_DATA_LICENSED.</p>
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!rows && !error ? <LoadingState /> : null}
      <ul className="space-y-2">
        {rows?.map((row) => (
          <li key={row.symbol} className="card text-sm">
            <span className="font-medium">{row.symbol}</span>
            <span className="text-muted"> · {row.segment} · tick {row.tickSize} · {row.eligibilitySource} · {row.dataLabel}</span>
          </li>
        ))}
      </ul>
      <form className="card space-y-3" onSubmit={(event) => void save(event)}>
        <h2 className="font-semibold">Import a row</h2>
        <input className="field" placeholder="Symbol" value={symbol} onChange={(event) => setSymbol(event.target.value)} />
        <select className="field" value={segment} onChange={(event) => setSegment(event.target.value)}>
          <option value="equity">Equity</option>
          <option value="futures">Futures</option>
          <option value="options">Options</option>
        </select>
        <input className="field" placeholder="Tick size" value={tickSize} onChange={(event) => setTickSize(event.target.value)} />
        <input className="field" placeholder="Source" value={source} onChange={(event) => setSource(event.target.value)} />
        <input className="field" placeholder="Effective from" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
        <input className="field" placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        <button className="btn-primary" type="submit">Save instrument</button>
        {message ? <p className="text-sm" role="status">{message}</p> : null}
      </form>
    </div>
  );
}
