"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";
import { formatInr } from "@/lib/money";

type Order = { orderId: string; planId: string; amountMinor: number; currency: string; status: string };

export default function SuccessPage() {
  return (
    <AppFrame requireAuth>
      <Suspense fallback={<LoadingState label="Loading order" />}>
        <Body />
      </Suspense>
    </AppFrame>
  );
}

function Body() {
  const params = useSearchParams();
  const orderId = params.get("orderId") ?? "";
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    apiFetch<Order>(`/api/v1/payment-orders?orderId=${encodeURIComponent(orderId)}`).then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOrder(result.data);
    });
  }

  useEffect(() => {
    if (orderId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-semibold text-ink">Payment recorded</h1>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!order && !error ? <LoadingState label="Loading order" /> : null}
      {order ? (
        <div className="card text-left">
          <p className="text-sm text-muted">Order {order.orderId}</p>
          <p className="mt-2 font-semibold text-ink">{order.planId}</p>
          <p className="tabular-nums text-ink">{formatInr(order.amountMinor)} {order.currency}</p>
          <p className="mt-2 text-sm text-muted">Status {order.status}. A placeholder order does not grant premium.</p>
        </div>
      ) : null}
      <Link href="/home" className="btn-primary w-full">Go to home</Link>
    </div>
  );
}
