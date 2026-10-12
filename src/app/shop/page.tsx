"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Chip, PageHeader } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { formatInr } from "@/lib/money";

type Product = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  approved: boolean;
  fulfillment: string;
};

type Catalog = { note: string; products: Product[]; fulfillment: string };

export default function ShopPage() {
  const { state } = useAuth();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    apiFetch<Catalog>("/api/v1/shop").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCatalog(result.data);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function hold(productId: string) {
    setBusy(true);
    const result = await apiFetch<{ message: string }>("/api/v1/shop/orders", {
      method: "POST",
      headers: { "idempotency-key": `shop_${productId}_${crypto.randomUUID()}` },
      body: JSON.stringify({ productId }),
    });
    setBusy(false);
    setMessage(result.ok ? result.data.message : result.message);
  }

  return (
    <AppFrame>
      <div className="space-y-4">
        <PageHeader title="Shop" lede={catalog?.note || "The catalogue is empty until products are published."} />
        {error ? <ErrorState message={error} onRetry={load} /> : null}
        {!catalog && !error ? <LoadingState label="Loading catalogue" /> : null}
        {catalog && catalog.products.length === 0 ? <EmptyState title="No products" body="The catalogue is empty." /> : null}
        <p className="text-sm text-muted">{catalog?.note}</p>
        <div className="grid gap-4 md:grid-cols-2">
          {catalog?.products.map((product) => (
            <article key={product.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">{product.name}</h2>
                <Chip>{product.approved ? "Approved" : "Unapproved"}</Chip>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">{product.description}</p>
              <p className="mt-4 text-2xl font-semibold tabular-nums tracking-tight text-ink">{formatInr(product.priceMinor)}</p>
              <p className="text-xs text-muted">
                Approved {product.approved ? "yes" : "no"} · fulfilment {product.fulfillment}
              </p>
              {state.status === "ready" ? (
                <button className="btn-secondary mt-4" type="button" disabled={busy} onClick={() => void hold(product.id)}>
                  Hold an order
                </button>
              ) : (
                <Link href="/sign-in" className="btn-secondary mt-4">Sign in to hold an order</Link>
              )}
            </article>
          ))}
        </div>
        {message ? <p className="text-sm" role="status">{message}</p> : null}
      </div>
    </AppFrame>
  );
}
