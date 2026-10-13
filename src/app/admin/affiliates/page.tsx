"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTitle } from "@/components/admin-ui";
import { OperationsGate } from "@/components/operations-gate";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Affiliate = {
  id: string;
  name: string;
  code: string;
  commissionBps: number;
  commissionPct: number;
  status: string;
  notes: string;
};

export default function AdminAffiliatesPage() {
  return (
    <AppFrame admin>
      <OperationsGate>
        <Body />
      </OperationsGate>
    </AppFrame>
  );
}

function Body() {
  const [rows, setRows] = useState<Affiliate[] | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [commission, setCommission] = useState("10");
  const [busy, setBusy] = useState(false);

  function load() {
    setError(null);
    apiFetch<{ affiliates: Affiliate[]; note: string }>("/api/v1/admin/affiliates").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setRows(result.data.affiliates);
      setNote(result.data.note);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const commissionBps = Math.round(Number(commission) * 100);
    if (!Number.isFinite(commissionBps)) {
      setMessage("Enter a commission percent.");
      return;
    }
    setBusy(true);
    const result = await apiFetch("/api/v1/admin/affiliates", {
      method: "POST",
      body: JSON.stringify({ name, code, commissionBps, notes: "" }),
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setName("");
    setCode("");
    setMessage("Partner saved.");
    load();
  }

  async function toggle(row: Affiliate) {
    const status = row.status === "active" ? "paused" : "active";
    const result = await apiFetch(`/api/v1/admin/affiliates/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setMessage(result.ok ? "Partner updated." : result.message);
    if (result.ok) load();
  }

  return (
    <div className="space-y-4">
      <AdminTitle title="Affiliates" lede={note || "Partners who share Instox. Commission is a note for your records. It does not move money."} />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      <form className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => void create(event)}>
        <label>
          <span className="label">Name</span>
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          <span className="label">Code</span>
          <input className="field" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        </label>
        <label>
          <span className="label">Commission %</span>
          <input className="field" inputMode="decimal" value={commission} onChange={(event) => setCommission(event.target.value)} />
        </label>
        <div className="flex items-end">
          <button className="btn-primary w-full" type="submit" disabled={busy}>Add partner</button>
        </div>
        {message ? <p className="text-sm text-ink sm:col-span-2 lg:col-span-4" role="status">{message}</p> : null}
      </form>
      {!rows && !error ? <LoadingState label="Loading partners" /> : null}
      {rows && rows.length === 0 ? <EmptyState title="No partners yet" body="Add a name and a code. The code is for your notes, not a live payout." /> : null}
      <ul className="space-y-2">
        {rows?.map((row) => (
          <li key={row.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink">{row.name}</p>
              <p className="text-sm text-muted">{row.code} · {row.commissionPct}% · {row.status}</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => void toggle(row)}>
              {row.status === "active" ? "Pause" : "Resume"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
