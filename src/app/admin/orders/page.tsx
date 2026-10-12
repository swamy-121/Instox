"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { OperationsGate } from "@/components/operations-gate";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";
import { formatInr } from "@/lib/money";

type Order = {
  id: string;
  uid: string;
  planId: string;
  provider: string;
  amountMinor: number;
  currency: string;
  status: string;
  entitlementGranted: boolean;
};

type Report = {
  unmatchedOrders: string[];
  duplicateEvents: string[];
  amountMismatches: string[];
  unverifiedEvents: string[];
};

export default function AdminOrdersPage() {
  return (
    <AppFrame admin>
      <OperationsGate>
        <Body />
      </OperationsGate>
    </AppFrame>
  );
}

function Body() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    apiFetch<{ orders: Order[] }>("/api/v1/admin/orders").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOrders(result.data.orders);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function reconcile(event: React.FormEvent) {
    event.preventDefault();
    const result = await apiFetch<{ report: Report }>("/api/v1/admin/orders/reconcile", {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setReport(result.data.report);
    setMessage("Reconciliation finished. Orders were not changed.");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-muted">ADM-10. Razorpay and Cashfree run only in test mode, and remote checkout stays off.</p>
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!orders && !error ? <LoadingState /> : null}
      {orders && orders.length === 0 ? <EmptyState title="No orders" body="Checkout orders will show here. A webhook cannot grant premium while the plan is unapproved." /> : null}
      <ul className="space-y-2">
        {orders?.map((order) => (
          <li key={order.id} className="card text-sm">
            <p className="font-medium">{order.id}</p>
            <p className="text-muted">
              {order.provider} · {order.status} · {formatInr(order.amountMinor)} {order.currency} · granted {order.entitlementGranted ? "yes" : "no"}
            </p>
          </li>
        ))}
      </ul>
      <form className="card space-y-3" onSubmit={(event) => void reconcile(event)}>
        <h2 className="font-semibold">Reconcile</h2>
        <input className="field" placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        <button className="btn-secondary" type="submit">Run reconciliation</button>
        {message ? <p className="text-sm" role="status">{message}</p> : null}
        {report ? (
          <p className="text-xs text-muted">
            Unmatched {report.unmatchedOrders.length}, duplicates {report.duplicateEvents.length}, amount mismatches {report.amountMismatches.length}, unverified {report.unverifiedEvents.length}.
          </p>
        ) : null}
      </form>
    </div>
  );
}
