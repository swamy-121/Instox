"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { OperationsGate } from "@/components/operations-gate";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Payload = {
  accounts: Array<{ uid: string; code: string; conversions: number }>;
  referrals: Array<{ referredUid: string; referrerUid: string; code: string; qualified: boolean }>;
  ledger: Array<{ id: string; status: string; reason: string; rewardDays: number }>;
};

export default function AdminReferralsPage() {
  return (
    <AppFrame admin>
      <OperationsGate>
        <Body />
      </OperationsGate>
    </AppFrame>
  );
}

function Body() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<Payload>("/api/v1/admin/referrals").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setData(result.data);
    });
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Referrals</h1>
        <p className="text-sm text-muted">ADM-11. Reward grants stay off until the referral rule is approved.</p>
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!data && !error ? <LoadingState /> : null}
      {data && data.accounts.length === 0 ? <EmptyState title="No referral accounts" body="Codes appear after a member signs in." /> : null}
      <ul className="space-y-2">
        {data?.accounts.map((row) => (
          <li key={row.uid} className="card text-sm">
            <span className="font-medium">{row.code}</span>
            <span className="text-muted"> · {row.uid} · {row.conversions} conversions</span>
          </li>
        ))}
      </ul>
      {data && data.ledger.length > 0 ? (
        <ul className="space-y-2">
          {data.ledger.map((row) => (
            <li key={row.id} className="card text-sm">
              {row.status}: {row.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
