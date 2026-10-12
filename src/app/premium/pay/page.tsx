"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";
import { formatInr } from "@/lib/money";

type Plan = { id: string; name: string; priceMinor: number; billingPeriod: string; approved: boolean };
type Method = { id: string; name: string; detail: string };

export default function PayPage() {
  return (
    <AppFrame requireAuth>
      <Suspense fallback={<LoadingState label="Loading payment" />}>
        <Body />
      </Suspense>
    </AppFrame>
  );
}

function Body() {
  const params = useSearchParams();
  const router = useRouter();
  const planId = params.get("planId") ?? "";
  const [plan, setPlan] = useState<Plan | null>(null);
  const [methods, setMethods] = useState<Method[] | null>(null);
  const [methodId, setMethodId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    setError(null);
    Promise.all([
      apiFetch<{ plans: Plan[] }>("/api/v1/plans"),
      apiFetch<{ records: Method[] }>("/api/v1/content/paymentMethods"),
    ]).then(([plans, pay]) => {
      if (!plans.ok) {
        setError(plans.message);
        return;
      }
      setPlan(plans.data.plans.find((row) => row.id === planId) ?? null);
      if (!pay.ok) {
        setError(pay.message);
        return;
      }
      setMethods(pay.data.records);
      setMethodId(pay.data.records[0]?.id ?? "");
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  async function pay() {
    setBusy(true);
    const result = await apiFetch<{ orderId: string; message: string }>("/api/v1/payment-orders", {
      method: "POST",
      headers: { "idempotency-key": `plan_${planId}_${crypto.randomUUID()}` },
      body: JSON.stringify({ planId }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push(`/premium/success?orderId=${result.data.orderId}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">Payment method</h1>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!methods && !error ? <LoadingState label="Loading methods" /> : null}
      {plan ? (
        <p className="text-sm text-ink">{plan.name} · {formatInr(plan.priceMinor)} · {plan.billingPeriod}. {plan.approved ? "Approved." : "This price is not approved, so checkout stays a placeholder."}</p>
      ) : methods ? <EmptyState title="Plan not found" body="Choose a plan that is still published." /> : null}
      {methods && methods.length === 0 ? <EmptyState title="No methods" body="Publish a payment method before checkout." /> : null}
      <ul className="space-y-2">
        {methods?.map((method) => (
          <li key={method.id}>
            <label className={`card flex cursor-pointer items-start gap-3 ${methodId === method.id ? "border-primary" : ""}`}>
              <input type="radio" name="method" checked={methodId === method.id} onChange={() => setMethodId(method.id)} />
              <span>
                <span className="block font-medium text-ink">{method.name}</span>
                <span className="block text-sm text-muted">{method.detail}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-primary w-full" disabled={!plan || !methodId || busy} onClick={() => void pay()}>
        {busy ? "Saving" : "Continue"}
      </button>
    </div>
  );
}
