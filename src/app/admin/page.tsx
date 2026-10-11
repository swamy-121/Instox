"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ErrorState, LoadingState } from "@/components/states";
import { Chip, PageHeader } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { canPublishTips } from "@/server/authorization/roles";
import type { ProviderHealth } from "@/server/market-data/adapter";

type Overview = {
  queue: { draft: number; inReview: number; published: number };
  paymentExceptions: unknown[];
  failedJobs: unknown[];
  marketData: ProviderHealth;
  note: string;
};

export default function AdminHomePage() {
  return (
    <AppFrame admin>
      <OverviewBody />
    </AppFrame>
  );
}

function OverviewBody() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<Overview>("/api/v1/admin/overview").then((result) => {
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
    <div>
      <PageHeader title="Admin overview" lede="Queue counts and provider status. Nothing here grants premium access." />
      {error ? <div className="mt-4"><ErrorState message={error} onRetry={load} /></div> : null}
      {!data && !error ? <LoadingState /> : null}
      {data ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Drafts" value={data.queue.draft} />
            <Stat label="In review" value={data.queue.inReview} />
            <Stat label="Published" value={data.queue.published} />
          </div>
          <section className="card">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">Market data</h2>
              <Chip>Sample</Chip>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink">{data.marketData.label}</p>
            <p className="mt-1 text-sm text-muted">Status: {data.marketData.status}. Licensed: {data.marketData.licensed ? "yes" : "no"}.</p>
          </section>
          <section className="card">
            <h2 className="text-base font-semibold text-ink">Payment exceptions</h2>
            {data.paymentExceptions.length === 0 ? (
              <p className="mt-2 text-sm leading-6 text-muted">None. Checkout does not collect money or grant premium in this build.</p>
            ) : null}
          </section>
          <section className="card">
            <h2 className="text-base font-semibold text-ink">Failed jobs</h2>
            {data.failedJobs.length === 0 ? <p className="mt-2 text-sm leading-6 text-muted">No background jobs are configured.</p> : null}
          </section>
          <AlertQueue />
          <p className="text-xs leading-5 text-muted">{data.note}</p>
        </div>
      ) : null}
    </div>
  );
}

function AlertQueue() {
  const { state } = useAuth();
  const [tipId, setTipId] = useState("tip_seed_free");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (state.status !== "ready" || !canPublishTips(state.me.roles)) return null;

  async function queue(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await apiFetch<{ notice?: string; campaign?: { counts?: Record<string, number> } }>("/api/v1/admin/notifications", {
      method: "POST",
      body: JSON.stringify({ tipId, kind: "transactional", reason }),
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    const counts = result.data.campaign?.counts;
    setMessage(result.data.notice ?? `Queued. ${JSON.stringify(counts ?? {})}`);
  }

  return (
    <form className="card space-y-4" onSubmit={(event) => void queue(event)}>
      <h2 className="text-base font-semibold text-ink">Tip alerts</h2>
      <p className="text-sm leading-6 text-muted">Queues a local alert plan. It does not include prices, and it does not send when VAPID keys are empty.</p>
      <label className="block">
        <span className="label" id="tip-id-label">Published tip id</span>
        <input id="tipId" aria-labelledby="tip-id-label" className="field" value={tipId} onChange={(event) => setTipId(event.target.value)} />
      </label>
      <label className="block">
        <span className="label" id="alert-reason-label">Reason</span>
        <input id="alertReason" aria-labelledby="alert-reason-label" className="field" value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <button className="btn-secondary" type="submit" disabled={busy}>Queue alert</button>
      {message ? <p className="text-sm" role="status">{message}</p> : null}
    </form>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-ink">{value}</p>
    </div>
  );
}
