"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicFooter, PublicHeader } from "@/components/chrome";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { formatInr } from "@/lib/money";
import type { PlanConfig } from "@/types/domain";

type PlansResponse = { termsVersion: string; note: string; plans: PlanConfig[] };
type OrderResponse = { orderId: string; status: string; amountMinor: number; currency: string; message: string; placeholder: boolean };

export default function PricingPage() {
  const { state } = useAuth();
  const [plans, setPlans] = useState<PlansResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    setError(null);
    apiFetch<PlansResponse>("/api/v1/plans").then((result) => {
      if (!result.ok) {
        setError(result.message);
        setRequestId(result.requestId);
        return;
      }
      setPlans(result.data);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function startCheckout(planId: string) {
    setBusy(true);
    setOrderMessage(null);
    const result = await apiFetch<OrderResponse>("/api/v1/payment-orders", {
      method: "POST",
      headers: { "idempotency-key": `plan_${planId}_${crypto.randomUUID()}` },
      body: JSON.stringify({ planId }),
    });
    setBusy(false);
    if (!result.ok) {
      setOrderMessage(result.message);
      return;
    }
    setOrderMessage("Order saved.");
  }

  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-semibold text-navy">Pricing</h1>
        <div className="mt-6">
          {!plans && !error ? <LoadingState label="Loading plans" /> : null}
          {error ? <ErrorState message={error} requestId={requestId} onRetry={load} /> : null}
          {plans && plans.plans.length === 0 ? <EmptyState title="No plans" body="No active plan is configured." /> : null}
          <div className="grid gap-4 md:grid-cols-2">
            {plans?.plans.map((plan) => (
              <article key={plan.id} className="card">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <p className="mt-2 text-sm text-muted">{plan.description}</p>
                <p className="mt-4 text-2xl font-semibold tabular-nums">{formatInr(plan.priceMinor)}</p>
                <p className="text-xs text-muted">{plan.billingPeriod}</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                {plan.id === "free" ? (
                  <Link href="/tips" className="btn-secondary mt-4">
                    View free tips
                  </Link>
                ) : state.status === "ready" ? (
                  <button type="button" className="btn-primary mt-4" disabled={busy} onClick={() => void startCheckout(plan.id)}>
                    {busy ? "Saving" : "Continue"}
                  </button>
                ) : (
                  <Link href="/sign-in" className="btn-primary mt-4">
                    Sign in to continue
                  </Link>
                )}
              </article>
            ))}
          </div>
          {orderMessage ? <p className="mt-4 text-sm text-ink">{orderMessage}</p> : null}
          {plans ? <p className="mt-6 text-xs text-muted">Terms version {plans.termsVersion}. {plans.note}</p> : null}
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
