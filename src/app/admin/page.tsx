"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ErrorState, LoadingState } from "@/components/states";
import { Chip, PageHeader } from "@/components/ui";
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
            {data.paymentExceptions.length === 0 ? <p className="mt-2 text-sm leading-6 text-muted">None. Checkout is a stub and does not grant premium.</p> : null}
          </section>
          <section className="card">
            <h2 className="text-base font-semibold text-ink">Failed jobs</h2>
            {data.failedJobs.length === 0 ? <p className="mt-2 text-sm leading-6 text-muted">No background jobs are configured.</p> : null}
          </section>
          <p className="text-xs leading-5 text-muted">{data.note}</p>
        </div>
      ) : null}
    </div>
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
