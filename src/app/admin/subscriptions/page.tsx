"use client";

import { useEffect, useMemo, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTabs, AdminTitle, Pager, Pill, usePage } from "@/components/admin-ui";
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
      <Body />
    </AppFrame>
  );
}

function Body() {
  const { state } = useAuth();
  const [rows, setRows] = useState<Subscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  function load() {
    setLoading(true);
    apiFetch<{ subscriptions: Subscription[] }>("/api/v1/admin/subscriptions").then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setRows(result.data.subscriptions);
    });
  }

  useEffect(() => {
    if (state.status === "ready") load();
  }, [state.status]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (tab !== "all" && bucket(row.status) !== tab) return false;
      if (!q.trim()) return true;
      const hay = `${row.displayName} ${row.phoneNumber ?? ""} ${row.planName}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  }, [q, rows, tab]);
  const pager = usePage(filtered, 8);

  if (state.status === "ready" && !canViewUsers(state.me.roles)) {
    return <PermissionDenied message="Subscriptions are limited to support and administrators." />;
  }

  const count = (id: string) => (id === "all" ? rows.length : rows.filter((row) => bucket(row.status) === id).length);

  return (
    <div>
      <AdminTitle title="Subscriptions" lede="Plan entitlements already on accounts." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminTabs
          tabs={[
            { id: "all", label: "All", count: count("all") },
            { id: "active", label: "Active", count: count("active") },
            { id: "expired", label: "Expired", count: count("expired") },
            { id: "cancelled", label: "Cancelled", count: count("cancelled") },
          ]}
          value={tab}
          onChange={(id) => {
            setTab(id);
            pager.setPage(1);
          }}
        />
        <input className="field h-10 w-64" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search by name or phone" aria-label="Search subscriptions" />
      </div>
      {error ? <div className="mt-4"><ErrorState message={error} onRetry={load} /></div> : null}
      {loading && rows.length === 0 ? <div className="mt-4"><LoadingState /></div> : null}
      {!loading && filtered.length === 0 ? <div className="mt-4"><EmptyState title="No subscriptions" body="Entitlement records will show up here." /></div> : null}
      {filtered.length > 0 ? (
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
              {pager.slice.map((row) => {
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
          <Pager page={pager.page} pages={pager.pages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
        </div>
      ) : null}
    </div>
  );
}
