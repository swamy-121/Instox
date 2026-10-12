"use client";

import { Suspense, useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTabs, AdminTitle, Pill } from "@/components/admin-ui";
import { ListPager, ListToolbar, useListQuery } from "@/components/list-bar";
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { formatInr } from "@/lib/money";
import { canViewUsers } from "@/server/authorization/roles";

type Subscription = {
  uid: string;
  displayName: string;
  phoneNumber: string | null;
  planId: string;
  planName: string;
  amountMinor: number;
  status: string;
  startsAt: string;
  endsAt: string;
};

function bucket(status: string): "active" | "expired" | "cancelled" | "other" {
  if (status === "active" || status === "grace") return "active";
  if (status === "expired") return "expired";
  if (status === "revoked") return "cancelled";
  return "other";
}

function when(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
}

export default function SubscriptionsPage() {
  return (
    <AppFrame admin>
      <Suspense fallback={<LoadingState label="Loading subscriptions" />}>
        <Body />
      </Suspense>
    </AppFrame>
  );
}

function Body() {
  const { state } = useAuth();
  const list = useListQuery();
  const [rows, setRows] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);
  const [counts, setCounts] = useState({ all: 0, active: 0, expired: 0, cancelled: 0 });
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    apiFetch<{ subscriptions: Subscription[]; counts: typeof counts; plans: Array<{ id: string; name: string }>; total: number }>(`/api/v1/admin/subscriptions?${list.queryString(["q", "status", "plan", "from", "to"])}`).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setRows(result.data.subscriptions);
      setCounts(result.data.counts);
      setPlans(result.data.plans);
      setTotal(result.data.total);
    });
  }

  useEffect(() => {
    if (state.status === "ready") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, list.search]);

  if (state.status === "ready" && !canViewUsers(state.me.roles)) {
    return <PermissionDenied message="Subscriptions are limited to support and administrators." />;
  }

  const tab = list.search.get("status") || "all";

  return (
    <div>
      <AdminTitle title="Subscriptions" lede="Plan entitlements already on accounts." />
      <AdminTabs
        tabs={[
          { id: "all", label: "All", count: counts.all },
          { id: "active", label: "Active", count: counts.active },
          { id: "expired", label: "Expired", count: counts.expired },
          { id: "cancelled", label: "Cancelled", count: counts.cancelled },
        ]}
        value={tab}
        onChange={(id) => list.set({ status: id === "all" ? null : id })}
      />
      <div className="mt-3">
        <ListToolbar
          desktop="inline"
          placeholder="Name or phone"
          filters={[
            { kind: "select", name: "plan", label: "Plan", empty: "Any plan", options: plans.map((plan) => ({ value: plan.id, label: plan.name })) },
            { kind: "dates" },
          ]}
        />
      </div>
      {error ? <div className="mt-4"><ErrorState message={error} onRetry={load} /></div> : null}
      {loading && rows.length === 0 ? <div className="mt-4"><LoadingState /></div> : null}
      {!loading && rows.length === 0 ? <div className="mt-4"><EmptyState title="No subscriptions" body="Entitlement records will show up here." /></div> : null}
      {rows.length > 0 ? (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Phone</th>
                <th className="px-3 py-3 font-medium">Plan</th>
                <th className="px-3 py-3 font-medium">Amount</th>
                <th className="px-3 py-3 font-medium">Start</th>
                <th className="px-3 py-3 font-medium">End</th>
                <th className="px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const group = bucket(row.status);
                return (
                  <tr key={row.uid} className="border-b border-line last:border-0">
                    <td className="px-3 py-3 font-medium text-ink">{row.displayName}</td>
                    <td className="px-3 py-3">{row.phoneNumber ?? ""}</td>
                    <td className="px-3 py-3">{row.planName}</td>
                    <td className="px-3 py-3 tabular-nums">{formatInr(row.amountMinor)}</td>
                    <td className="px-3 py-3 tabular-nums">{when(row.startsAt)}</td>
                    <td className="px-3 py-3 tabular-nums">{when(row.endsAt)}</td>
                    <td className="px-3 py-3">
                      <Pill tone={group === "active" ? "green" : group === "expired" ? "red" : "gray"}>
                        {group === "active" ? "Active" : group === "expired" ? "Expired" : group === "cancelled" ? "Cancelled" : row.status}
                      </Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {!loading && !error ? <ListPager total={total} page={list.page} pageSize={list.pageSize} /> : null}
    </div>
  );
}
