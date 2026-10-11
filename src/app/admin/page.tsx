"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";
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
      <h1 className="text-2xl font-semibold">Admin overview</h1>
      {error ? <div className="mt-4"><ErrorState message={error} onRetry={load} /></div> : null}
      {!data && !error ? <div className="mt-4"><LoadingState /></div> : null}
      {data ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Drafts" value={data.queue.draft} />
            <Stat label="In review" value={data.queue.inReview} />
            <Stat label="Published" value={data.queue.published} />
          </div>
          <section className="card mt-4">
            <h2 className="font-semibold">Market data</h2>
            <p className="mt-2 text-sm">{data.marketData.label}</p>
            <p className="text-sm text-muted">Status: {data.marketData.status}. Licensed: {data.marketData.licensed ? "yes" : "no"}.</p>
          </section>
          <section className="card mt-4">
            <h2 className="font-semibold">Payment exceptions</h2>
            {data.paymentExceptions.length === 0 ? <p className="mt-2 text-sm text-muted">None. Checkout is a stub and does not grant premium.</p> : null}
          </section>
          <section className="card mt-4">
            <h2 className="font-semibold">Failed jobs</h2>
            {data.failedJobs.length === 0 ? <p className="mt-2 text-sm text-muted">No background jobs are configured.</p> : null}
          </section>
          <p className="mt-4 text-xs text-muted">{data.note}</p>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
