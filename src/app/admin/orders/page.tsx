"use client";

import { Suspense, useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTitle, Pill } from "@/components/admin-ui";
import { ListBar, ListPager, useListQuery } from "@/components/list-bar";
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
        <Suspense fallback={<LoadingState label="Loading orders" />}>
          <Body />
        </Suspense>
      </OperationsGate>
    </AppFrame>
  );
}

function Body() {
  const list = useListQuery();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [nextStatus, setNextStatus] = useState<Record<string, string>>({});
  const [report, setReport] = useState<Report | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    apiFetch<{ orders: Order[]; total: number }>(`/api/v1/admin/orders?${list.queryString(["q", "status", "from", "to"])}`).then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setOrders(result.data.orders);
      setTotal(result.data.total);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.search]);

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

  async function updateStatus(orderId: string) {
    const status = nextStatus[orderId];
    if (!status) {
      setMessage("Choose refunded, disputed, or failed.");
      return;
    }
    const result = await apiFetch<{ unchanged?: boolean }>(`/api/v1/admin/orders/${orderId}`, {
      method: "POST",
      body: JSON.stringify({ status, reason: statusReason }),
    });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage(result.data.unchanged ? "That status was already saved." : "Status saved. Premium was not granted.");
    load();
  }

  return (
    <div>
      <AdminTitle title="Orders" lede="Recorded payment orders. You can mark one refunded, disputed, or failed. That does not mark it paid and does not grant premium. A refund or dispute revokes a payment entitlement from that order. Reconciliation does not change orders." />
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label>
          <span className="label">Status</span>
          <select className="field w-44" value={list.search.get("status") ?? ""} aria-label="Status" onChange={(event) => list.set({ status: event.target.value })}>
            <option value="">Any status</option>
            {["created", "checkout_pending", "paid_verified", "failed", "refunded", "disputed"].map((item) => (
              <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
        <div className="min-w-[16rem] flex-1">
          <ListBar placeholder="Order, user, or plan" showDates />
        </div>
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!orders && !error ? <LoadingState /> : null}
      {orders && orders.length === 0 ? <EmptyState title="No orders" body="Checkout orders will show here." /> : null}
      {orders && orders.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="px-3 py-3 font-medium">Order</th>
                <th className="px-3 py-3 font-medium">User</th>
                <th className="px-3 py-3 font-medium">Plan</th>
                <th className="px-3 py-3 font-medium">Amount</th>
                <th className="px-3 py-3 font-medium">Provider</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Update</th>
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
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <select
                        className="field h-9"
                        aria-label={`Status for ${order.id}`}
                        value={nextStatus[order.id] ?? ""}
                        onChange={(event) => setNextStatus({ ...nextStatus, [order.id]: event.target.value })}
                      >
                        <option value="">Choose</option>
                        <option value="refunded">Refunded</option>
                        <option value="disputed">Disputed</option>
                        <option value="failed">Failed</option>
                      </select>
                      <button type="button" className="btn-secondary h-9" onClick={() => void updateStatus(order.id)}>Save</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {orders ? <ListPager total={total} page={list.page} pageSize={list.pageSize} /> : null}
      <form className="card mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); }}>
        <h2 className="font-semibold text-ink">Status reason</h2>
        <p className="text-sm text-muted">Required when you save a refund, dispute, or failure.</p>
        <input className="field" placeholder="Reason" value={statusReason} onChange={(event) => setStatusReason(event.target.value)} />
      </form>
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
