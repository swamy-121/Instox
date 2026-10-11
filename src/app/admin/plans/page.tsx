"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { OperationsGate } from "@/components/operations-gate";
import { ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";
import { formatInr } from "@/lib/money";
import type { PlanConfig } from "@/types/domain";

export default function AdminPlansPage() {
  return (
    <AppFrame admin>
      <OperationsGate>
        <Body />
      </OperationsGate>
    </AppFrame>
  );
}

function Body() {
  const [plans, setPlans] = useState<PlanConfig[] | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uid, setUid] = useState("");
  const [planId, setPlanId] = useState("premium_monthly");
  const [days, setDays] = useState("30");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    apiFetch<{ plans: PlanConfig[]; note: string }>("/api/v1/admin/plans").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPlans(result.data.plans);
      setNote(result.data.note);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function change(action: "grant" | "revoke") {
    const result = await apiFetch<{ message?: string }>("/api/v1/admin/entitlements", {
      method: "POST",
      body: JSON.stringify({
        uid,
        action,
        planId,
        days: Number(days),
        reason,
      }),
    });
    setMessage(result.ok ? result.data.message ?? `Entitlement ${action} recorded.` : result.message);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Plans and entitlements</h1>
        <p className="text-sm text-muted">ADM-09. Prices stay in config. A manual grant is audited and is not a payment.</p>
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!plans && !error ? <LoadingState /> : null}
      <p className="text-sm text-muted">{note}</p>
      <ul className="space-y-2">
        {plans?.map((plan) => (
          <li key={plan.id} className="card text-sm">
            <p className="font-medium">{plan.name}</p>
            <p>{formatInr(plan.priceMinor)} · approved {plan.approved ? "yes" : "no"} · {plan.billingPeriod}</p>
          </li>
        ))}
      </ul>
      <form
        className="card space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void change("grant");
        }}
      >
        <h2 className="font-semibold">Manual grant or revoke</h2>
        <input className="field" placeholder="User id" value={uid} onChange={(event) => setUid(event.target.value)} />
        <input className="field" placeholder="Plan id" value={planId} onChange={(event) => setPlanId(event.target.value)} />
        <input className="field" placeholder="Days" value={days} onChange={(event) => setDays(event.target.value)} />
        <input className="field" placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        <div className="flex gap-2">
          <button className="btn-primary" type="submit">Grant</button>
          <button className="btn-secondary" type="button" onClick={() => void change("revoke")}>Revoke</button>
        </div>
        {message ? <p className="text-sm" role="status">{message}</p> : null}
      </form>
    </div>
  );
}
