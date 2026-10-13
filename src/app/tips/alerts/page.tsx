"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Prefs = { targetHit: boolean; stopLoss: boolean; expired: boolean };
type Alert = { id: string; title: string; body: string; readAt: string | null; createdAt: string };

export default function TipAlertsPage() {
  return (
    <AppFrame requireAuth>
      <AlertsBody />
    </AppFrame>
  );
}

function AlertsBody() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    setError(null);
    apiFetch<{ prefs: Prefs; alerts: Alert[] }>("/api/v1/tip-alerts").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPrefs(result.data.prefs);
      setAlerts(result.data.alerts);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function save(next: Prefs) {
    setPrefs(next);
    const result = await apiFetch("/api/v1/tip-alerts", { method: "PUT", body: JSON.stringify(next) });
    setMessage(result.ok ? "Alert choices saved." : result.message);
  }

  async function markRead(id: string) {
    const result = await apiFetch(`/api/v1/tip-alerts/${id}/read`, { method: "POST" });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setAlerts((current) => current?.map((alert) => (alert.id === id ? { ...alert, readAt: new Date().toISOString() } : alert)) ?? null);
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Tip alerts</h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
          Notes for ideas you track. A target or a stop is a result, not a new idea, and it is not a promise about the next one.
        </p>
      </header>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!prefs && !error ? <LoadingState label="Loading alerts" /> : null}
      {prefs ? (
        <form className="card space-y-3">
          <h2 className="text-base font-semibold text-ink">What should we note?</h2>
          <Choice label="Target reached" checked={prefs.targetHit} onChange={(targetHit) => void save({ ...prefs, targetHit })} />
          <Choice label="Stop reached" checked={prefs.stopLoss} onChange={(stopLoss) => void save({ ...prefs, stopLoss })} />
          <Choice label="Window ended" checked={prefs.expired} onChange={(expired) => void save({ ...prefs, expired })} />
          {message ? <p className="text-sm text-muted" role="status">{message}</p> : null}
        </form>
      ) : null}
      {alerts && alerts.length === 0 ? <EmptyState title="No result notes yet" body="Track an idea, then run the daily check. Notes will land here." /> : null}
      <ul className="space-y-2">
        {alerts?.map((alert) => (
          <li key={alert.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{alert.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{alert.body}</p>
              </div>
              {alert.readAt ? <span className="shrink-0 text-xs text-muted">Read</span> : (
                <button type="button" className="btn-secondary shrink-0" onClick={() => void markRead(alert.id)}>Mark read</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Choice({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-ink">
      <span>{label}</span>
      <input type="checkbox" className="h-4 w-4 accent-primary" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
