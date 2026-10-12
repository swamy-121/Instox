"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTitle, Pill } from "@/components/admin-ui";
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
    <div>
      <AdminTitle title="Orders" lede="Recorded payment orders. Reconciliation does not change them." />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!orders && !error ? <LoadingState /> : null}
      {orders && orders.length === 0 ? <EmptyState title="No orders" body="Checkout orders will show here." /> : null}
      {orders && orders.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-3 font-medium">Order</th>
                <th className="px-3 py-3 font-medium">User</th>
                <th className="px-3 py-3 font-medium">Plan</th>
                <th className="px-3 py-3 font-medium">Amount</th>
                <th className="px-3 py-3 font-medium">Provider</th>
                <th className="px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-3 font-medium text-ink">{order.id}</td>
                  <td className="px-3 py-3">{order.uid}</td>
                  <td className="px-3 py-3">{order.planId}</td>
                  <td className="px-3 py-3 tabular-nums">{formatInr(order.amountMinor)}</td>
                  <td className="px-3 py-3">{order.provider}</td>
                  <td className="px-3 py-3"><Pill tone="gray">{order.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <form className="card mt-4 space-y-3" onSubmit={(event) => void reconcile(event)}>
        <h2 className="font-semibold text-ink">Reconcile</h2>
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
