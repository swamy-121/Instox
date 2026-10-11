"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Rule = { indicator: "rsi" | "ema" | "cpr"; operator: string; value?: number };
type Strategy = { id: string; name: string; rules: Rule[]; version: number; status: string };

export default function StrategiesPage() {
  return (
    <AppFrame requireAuth>
      <StrategiesBody />
    </AppFrame>
  );
}

function StrategiesBody() {
  const [rows, setRows] = useState<Strategy[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [indicator, setIndicator] = useState<Rule["indicator"]>("rsi");
  const [operator, setOperator] = useState("lt");
  const [value, setValue] = useState("30");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    apiFetch<{ strategies: Strategy[]; note: string }>("/api/v1/strategies").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setRows(result.data.strategies);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const rule: Rule = indicator === "rsi" ? { indicator, operator, value: Number(value) } : { indicator, operator };
    const result = await apiFetch<{ strategy: Strategy }>("/api/v1/strategies", {
      method: "POST",
      body: JSON.stringify({ name, rules: [rule] }),
    });
    setBusy(false);
    setMessage(result.ok ? `Saved ${result.data.strategy.name} as draft version ${result.data.strategy.version}.` : result.message);
    if (result.ok) {
      setName("");
      load();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Strategy builder</h1>
        <p className="mt-1 text-sm text-muted">Rules stay in draft and version when you change them. Saving a strategy does not publish a tip.</p>
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!rows && !error ? <LoadingState /> : null}
      {rows && rows.length === 0 ? <EmptyState title="No strategies" body="Create a draft rule. It will not be published." /> : null}
      <ul className="space-y-2">
        {rows?.map((row) => (
          <li key={row.id} className="card text-sm">
            <p className="font-medium">{row.name}</p>
            <p className="text-muted">Version {row.version} · {row.status}</p>
            <p className="mt-1">{row.rules.map((rule) => `${rule.indicator} ${rule.operator} ${rule.value ?? ""}`).join(", ")}</p>
          </li>
        ))}
      </ul>
      <form className="card space-y-3" onSubmit={(event) => void save(event)}>
        <h2 className="font-semibold">New draft</h2>
        <input className="field" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            className="field"
            value={indicator}
            onChange={(event) => {
              const next = event.target.value as Rule["indicator"];
              setIndicator(next);
              setOperator(next === "rsi" ? "lt" : next === "ema" ? "above" : "inside");
            }}
          >
            <option value="rsi">RSI</option>
            <option value="ema">EMA</option>
            <option value="cpr">CPR</option>
          </select>
          <select className="field" value={operator} onChange={(event) => setOperator(event.target.value)}>
            {indicator === "rsi" ? (
              <>
                <option value="lt">Below</option>
                <option value="gt">Above</option>
              </>
            ) : null}
            {indicator === "ema" ? (
              <>
                <option value="above">Price above</option>
                <option value="below">Price below</option>
              </>
            ) : null}
            {indicator === "cpr" ? (
              <>
                <option value="above">Above top</option>
                <option value="inside">Inside</option>
                <option value="below">Below bottom</option>
              </>
            ) : null}
          </select>
          {indicator === "rsi" ? (
            <input className="field" value={value} onChange={(event) => setValue(event.target.value)} />
          ) : (
            <span className="self-center text-sm text-muted">No threshold</span>
          )}
        </div>
        <button className="btn-primary" type="submit" disabled={busy}>Save draft</button>
        {message ? <p className="text-sm" role="status">{message}</p> : null}
      </form>
    </div>
  );
}
