"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Me = {
  code: string;
  conversions: number;
  threshold: number;
  rewardEnabled: boolean;
  message: string;
  usedCode: string | null;
  ledger: Array<{ id: string; status: string; reason: string }>;
};

export default function ReferralsPage() {
  return (
    <AppFrame requireAuth>
      <ReferralsBody />
    </AppFrame>
  );
}

function ReferralsBody() {
  const [me, setMe] = useState<Me | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    apiFetch<Me>("/api/v1/referrals/me").then((result) => {
      if (!result.ok) {
        setError(result.message);
        setRequestId(result.requestId);
        return;
      }
      setMe(result.data);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const result = await apiFetch<{ message: string }>("/api/v1/referrals/validate", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setNotice(result.data.message);
    setCode("");
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Referrals</h1>
        <p className="mt-1 text-sm text-muted">Codes are accepted, but rewards do not grant premium while that rule is unapproved.</p>
      </div>
      {error ? <ErrorState message={error} requestId={requestId} onRetry={load} /> : null}
      {!me && !error ? <LoadingState label="Loading referral code" /> : null}
      {me ? (
        <section className="card">
          <p className="text-sm text-muted">Your code</p>
          <p className="mt-1 text-2xl font-semibold tracking-wide">{me.code}</p>
          <p className="mt-2 text-sm">Conversions {me.conversions} of {me.threshold}. Rewards {me.rewardEnabled ? "on" : "off"}.</p>
          <p className="mt-2 text-sm text-muted">{me.message}</p>
          {me.usedCode ? <p className="mt-2 text-sm">You used code {me.usedCode}.</p> : null}
        </section>
      ) : null}
      <form className="card space-y-3" onSubmit={(event) => void submit(event)}>
        <label className="label" htmlFor="code">Apply a code</label>
        <input id="code" className="field" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        <button className="btn-primary" type="submit" disabled={busy}>Apply</button>
        {notice ? <p className="text-sm" role="status">{notice}</p> : null}
      </form>
      {me && me.ledger.length > 0 ? (
        <ul className="space-y-2">
          {me.ledger.map((row) => (
            <li key={row.id} className="card text-sm">
              <p className="font-medium">{row.status}</p>
              <p className="text-muted">{row.reason}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
