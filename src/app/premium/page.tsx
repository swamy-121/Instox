"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Chip } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { formatInr } from "@/lib/money";

type Plan = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  billingPeriod: string;
  features: string[];
  approved: boolean;
  listed?: boolean;
  mostPopular?: boolean;
};
type Payload = { plans: Plan[]; note: string };

export default function PremiumPage() {
  return (
    <AppFrame>
      <Body />
    </AppFrame>
  );
}

function Body() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");

  function load() {
    setError(null);
    apiFetch<Payload>("/api/v1/plans").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPayload(result.data);
    });
  }

  useEffect(() => {
    load();
  }, []);

  const plans = payload?.plans.filter((plan) => plan.listed !== false && plan.billingPeriod === period) ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">Go Premium</h1>
      <div className="grid grid-cols-2 rounded-full bg-canvas p-1 text-sm font-medium">
        {(["monthly", "yearly"] as const).map((item) => (
          <button key={item} type="button" className={`h-10 rounded-full capitalize ${period === item ? "bg-primary text-white" : "text-ink"}`} onClick={() => setPeriod(item)}>
            {item}
          </button>
        ))}
      </div>
      {payload?.note ? <p className="text-sm text-muted">{payload.note}</p> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!payload && !error ? <LoadingState label="Loading plans" /> : null}
      {payload && plans.length === 0 ? <EmptyState title="No plans" body="Publish a listed plan for this billing period." /> : null}
      <ul className="space-y-3">
        {plans.map((plan) => (
          <li key={plan.id} className="card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">{plan.name}</h2>
              {plan.mostPopular ? <Chip tone="info">Most popular</Chip> : null}
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{formatInr(plan.priceMinor)}<span className="text-sm font-normal text-muted"> / {plan.billingPeriod}</span></p>
            <p className="mt-1 text-xs text-muted">{plan.approved ? "Approved" : "Not approved"}</p>
            <ul className="mt-3 space-y-1 text-sm text-ink">
              {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <p className="mt-2 text-sm text-muted">{plan.description}</p>
            <Link href={`/premium/pay?planId=${plan.id}`} className="btn-primary mt-4 w-full">Choose plan</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
