"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTabs, AdminTitle } from "@/components/admin-ui";
import { OperationsGate } from "@/components/operations-gate";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/money";

type Presets = {
  rsiPeriod: number;
  rsiBelow: number;
  rsiAbove: number;
  rsiSide: "below" | "above";
  emaPeriod: number;
  emaSide: "above" | "below";
  cprSide: "above" | "below" | "inside";
};

type FormState = {
  rsiPeriod: string;
  rsiBelow: string;
  rsiAbove: string;
  rsiSide: "below" | "above";
  emaPeriod: string;
  emaSide: "above" | "below";
  cprSide: "above" | "below" | "inside";
};

type Row = {
  symbol: string;
  segment: string;
  last: number;
  indicators: { rsi: number | null; ema: number | null; cpr: { pivot: number } | null };
};

const EMPTY: FormState = {
  rsiPeriod: "",
  rsiBelow: "",
  rsiAbove: "",
  rsiSide: "below",
  emaPeriod: "",
  emaSide: "above",
  cprSide: "inside",
};

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
  const [tab, setTab] = useState("rsi");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  function applyPreset(presets: Presets | null) {
    if (!presets) {
      setForm(EMPTY);
      return;
    }
    setForm({
      rsiPeriod: String(presets.rsiPeriod),
      rsiBelow: String(presets.rsiBelow),
      rsiAbove: String(presets.rsiAbove),
      rsiSide: presets.rsiSide,
      emaPeriod: String(presets.emaPeriod),
      emaSide: presets.emaSide,
      cprSide: presets.cprSide,
    });
  }

  function load() {
    setLoading(true);
    apiFetch<{ presets: Presets | null }>("/api/v1/admin/screener/presets").then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      applyPreset(result.data.presets);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function payload(): Presets | null {
    const rsiPeriod = Number(form.rsiPeriod);
    const rsiBelow = Number(form.rsiBelow);
    const rsiAbove = Number(form.rsiAbove);
    const emaPeriod = Number(form.emaPeriod);
    if (![rsiPeriod, emaPeriod].every((value) => Number.isInteger(value)) || [rsiBelow, rsiAbove].some((value) => !Number.isFinite(value))) {
      return null;
    }
    return {
      rsiPeriod,
      rsiBelow,
      rsiAbove,
      rsiSide: form.rsiSide,
      emaPeriod,
      emaSide: form.emaSide,
      cprSide: form.cprSide,
    };
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const body = payload();
    if (!body) {
      setMessage("Enter the periods and thresholds.");
      return;
    }
    setBusy(true);
    const result = await apiFetch("/api/v1/admin/screener/presets", { method: "PUT", body: JSON.stringify(body) });
    setBusy(false);
    setMessage(result.ok ? "Settings saved." : result.message);
  }

  async function run() {
    const params = new URLSearchParams();
    if (tab === "rsi") {
      if (form.rsiPeriod) params.set("rsiPeriod", form.rsiPeriod);
      if (form.rsiSide === "below" && form.rsiBelow) params.set("rsiLt", form.rsiBelow);
      if (form.rsiSide === "above" && form.rsiAbove) params.set("rsiGt", form.rsiAbove);
    }
    if (tab === "ema") {
      if (form.emaPeriod) params.set("emaPeriod", form.emaPeriod);
      params.set("ema", form.emaSide);
    }
    if (tab === "cpr") params.set("cpr", form.cprSide);
    setBusy(true);
    const result = await apiFetch<{ results: Row[] }>(`/api/v1/screener?${params.toString()}`);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    const next = tab === "fo" ? result.data.results.filter((row) => row.segment !== "equity") : result.data.results;
    setRows(next);
    setMessage(null);
  }

  return (
    <div>
      <AdminTitle title="Screener Management" lede="Configure and manage stock screeners." />
      <AdminTabs
        tabs={[
          { id: "rsi", label: "RSI Screener" },
          { id: "ema", label: "EMA" },
          { id: "cpr", label: "CPR" },
          { id: "fo", label: "F&O" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {error ? <div className="mt-4"><ErrorState message={error} onRetry={load} /></div> : null}
      {loading ? <div className="mt-4"><LoadingState label="Loading settings" /></div> : null}
      {!loading && !error ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <form className="card space-y-4" onSubmit={(event) => void save(event)}>
            <h2 className="text-base font-semibold text-ink">
              {tab === "rsi" ? "RSI Screener Settings" : tab === "ema" ? "EMA Settings" : tab === "cpr" ? "CPR Settings" : "F&O Settings"}
            </h2>
            {tab === "rsi" ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <label>
                  <span className="label">RSI Period</span>
                  <input className="field" inputMode="numeric" value={form.rsiPeriod} onChange={(event) => setForm({ ...form, rsiPeriod: event.target.value })} />
                </label>
                <label>
                  <span className="label">RSI Below</span>
                  <input className="field" inputMode="decimal" value={form.rsiBelow} onChange={(event) => setForm({ ...form, rsiBelow: event.target.value })} />
                </label>
                <label>
                  <span className="label">RSI Above</span>
                  <input className="field" inputMode="decimal" value={form.rsiAbove} onChange={(event) => setForm({ ...form, rsiAbove: event.target.value })} />
                </label>
                <label className="sm:col-span-3">
                  <span className="label">Match</span>
                  <select className="field" value={form.rsiSide} onChange={(event) => setForm({ ...form, rsiSide: event.target.value as FormState["rsiSide"] })}>
                    <option value="below">Below the first threshold</option>
                    <option value="above">Above the second threshold</option>
                  </select>
                </label>
              </div>
            ) : null}
            {tab === "ema" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="label">EMA Period</span>
                  <input className="field" inputMode="numeric" value={form.emaPeriod} onChange={(event) => setForm({ ...form, emaPeriod: event.target.value })} />
                </label>
                <label>
                  <span className="label">Price vs EMA</span>
                  <select className="field" value={form.emaSide} onChange={(event) => setForm({ ...form, emaSide: event.target.value as FormState["emaSide"] })}>
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                  </select>
                </label>
              </div>
            ) : null}
            {tab === "cpr" ? (
              <label>
                <span className="label">Close vs CPR</span>
                <select className="field" value={form.cprSide} onChange={(event) => setForm({ ...form, cprSide: event.target.value as FormState["cprSide"] })}>
                  <option value="above">Above</option>
                  <option value="below">Below</option>
                  <option value="inside">Inside</option>
                </select>
              </label>
            ) : null}
            {tab === "fo" ? <p className="text-sm text-muted">This run keeps futures and options from the stored instrument list.</p> : null}
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" type="submit" disabled={busy}>Save Settings</button>
              <button className="btn-secondary" type="button" disabled={busy} onClick={() => void run()}>Run Screener</button>
            </div>
            {message ? <p className="text-sm text-ink" role="status">{message}</p> : null}
          </form>
          <section className="card">
            <h2 className="text-base font-semibold text-ink">Preview Results</h2>
            {rows && rows.length === 0 ? <div className="mt-4"><EmptyState title="No matches" body="Change the thresholds and run the screener again." /></div> : null}
            {rows && rows.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 font-medium">Symbol</th>
                      <th className="py-2 font-medium">LTP</th>
                      <th className="py-2 font-medium">{tab === "ema" ? "EMA" : "RSI"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.symbol} className="border-b border-line last:border-0">
                        <td className="py-2 font-medium text-ink">{row.symbol}</td>
                        <td className="py-2 tabular-nums">{formatPrice(row.last)}</td>
                        <td className="py-2 tabular-nums">
                          {tab === "ema"
                            ? row.indicators.ema == null ? "" : formatPrice(row.indicators.ema)
                            : row.indicators.rsi == null ? "" : row.indicators.rsi.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {!rows ? <p className="mt-4 text-sm text-muted">Run the screener to fill this table from stored candles.</p> : null}
          </section>
        </div>
      ) : null}
      {!loading && !error ? <ManualRuns /> : null}
    </div>
  );
}

function ManualRuns() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"screen" | "tips" | null>(null);

  async function runScreen() {
    setBusy("screen");
    const result = await apiFetch<{ notice: string; standout: number; optionSelling: number; sideways: number; bhavcopy: { notice: string }; oi: { notice: string } }>(
      "/api/v1/admin/screener/trigger",
      { method: "POST" },
    );
    setBusy(null);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    const data = result.data;
    setMessage(`${data.notice} ${data.standout} names stand out, ${data.optionSelling} option-selling names, ${data.sideways} sideways names. ${data.bhavcopy.notice} ${data.oi.notice}`);
  }

  async function runTips() {
    setBusy("tips");
    const result = await apiFetch<{ notice: string; checked: number; updated: number; missingPrice: number; alerts: number }>(
      "/api/v1/jobs/daily-tips",
      { method: "POST" },
    );
    setBusy(null);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    const data = result.data;
    setMessage(`${data.notice} Checked ${data.checked}. Updated ${data.updated}. Missing a nearby price for ${data.missingPrice}. Result notes sent: ${data.alerts}.`);
  }

  return (
    <section className="card mt-4 space-y-3">
      <h2 className="text-base font-semibold text-ink">Run it now</h2>
      <p className="text-sm leading-6 text-muted">
        Refresh the end-of-day screens, or check open ideas for a target, a stop, or an ended window. Without a file address, sample prices are used.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn-primary" disabled={busy !== null} onClick={() => void runScreen()}>
          {busy === "screen" ? "Running screen" : "Run screeners"}
        </button>
        <button type="button" className="btn-secondary" disabled={busy !== null} onClick={() => void runTips()}>
          {busy === "tips" ? "Checking ideas" : "Check open ideas"}
        </button>
      </div>
      {message ? <p className="text-sm leading-6 text-ink" role="status">{message}</p> : null}
    </section>
  );
}
