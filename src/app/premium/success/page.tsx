"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { Confetti } from "@/components/illustrations";
import { ErrorState, LoadingState } from "@/components/states";
import { useMemberConfig } from "@/features/app/member-config";
import { apiFetch } from "@/lib/api-client";

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
  const config = useMemberConfig();
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
    else setError("We couldn't find that order.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return (
    <div className="relative mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-2 text-center">
      {order ? <Confetti /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!order && !error ? <LoadingState label="Loading order" /> : null}
      {order ? (
        <>
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-white shadow-card">
            <Check className="h-12 w-12" strokeWidth={3} aria-hidden="true" />
          </span>
          <h1 className="mt-6 text-2xl font-semibold text-ink">{config.paymentSuccessTitle}</h1>
          <p className="mt-2 text-sm text-muted">{config.paymentSuccessBody}</p>
          <Link href="/home" className="btn-primary mt-8 w-full">{config.paymentSuccessCta}</Link>
        </>
      ) : null}
    </div>
  );
}
