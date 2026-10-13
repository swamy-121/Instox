"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useMemberConfig } from "@/features/app/member-config";
import { apiFetch } from "@/lib/api-client";
import { formatInr } from "@/lib/money";

type Plan = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  billingPeriod: string;
  features: string[];
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
  const config = useMemberConfig();
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
      <h1 className="sr-only">{config.premiumTitle}</h1>
      <div className="grid grid-cols-2 rounded-full bg-canvas p-1 text-sm font-medium">
        {(["monthly", "yearly"] as const).map((item) => (
          <button key={item} type="button" className={`h-10 rounded-full capitalize ${period === item ? "bg-primary text-white" : "text-ink"}`} onClick={() => setPeriod(item)}>
            {item}
          </button>
        ))}
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!payload && !error ? <LoadingState label="Loading plans" /> : null}
      {payload && plans.length === 0 ? <EmptyState title="No plans" body="No plans for this period right now. Please check back soon." /> : null}
      <ul className="space-y-4 pt-2">
        {plans.map((plan) => (
          <li key={plan.id} className={`card relative ${plan.mostPopular ? "border-2 border-[#E8772E]" : ""}`}>
            {plan.mostPopular ? (
              <span className="absolute -top-3 right-4 rounded-full bg-[#E8772E] px-2.5 py-1 text-xs font-semibold text-white">{config.popularBadge}</span>
            ) : null}
            <h2 className="text-lg font-semibold text-ink">{plan.name}</h2>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
              {formatInr(plan.priceMinor)}
              <span className="text-sm font-normal text-muted"> / {plan.billingPeriod === "monthly" ? "month" : plan.billingPeriod}</span>
            </p>
            <ul className="mt-3 space-y-2 text-sm text-ink">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link href={`/premium/pay?planId=${plan.id}`} className="btn-primary mt-4 w-full">Choose plan</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
