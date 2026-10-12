"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTabs, AdminTitle, Pill } from "@/components/admin-ui";
import { ListBar, ListPager, useListQuery } from "@/components/list-bar";
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { canManageUsers } from "@/server/authorization/roles";
import { ROLES, USER_STATUSES, type Role, type UserStatus } from "@/types/domain";

type AdminUser = {
  uid: string;
  displayName: string;
  status: UserStatus;
  roles?: Role[];
  email: string | null;
  phoneNumber: string | null;
  createdAt: string;
  planId: string;
  planStatus: string;
};

export default function UsersPage() {
  return (
    <AppFrame admin>
      <Suspense fallback={<LoadingState label="Loading users" />}>
        <Users />
      </Suspense>
    </AppFrame>
  );
}

function Users() {
  const { state } = useAuth();
  const list = useListQuery();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [counts, setCounts] = useState({ all: 0, free: 0, premium: 0 });
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<AdminUser | null>(null);
  const [pending, setPending] = useState<{ uid: string; roles: Role[]; status: UserStatus; reason: string } | null>(null);
  const [disableId, setDisableId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    apiFetch<{ users: AdminUser[]; counts: { all: number; free: number; premium: number }; total: number }>(`/api/v1/admin/users?${list.queryString(["q", "status", "plan", "from", "to"])}`).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setUsers(result.data.users);
      setCounts(result.data.counts);
      setTotal(result.data.total);
    });
  }

  useEffect(() => {
    if (state.status === "ready") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, list.search]);

  if (state.status === "ready" && !state.me.roles.some((role) => role === "support" || role === "admin" || role === "super_admin")) {
    return <PermissionDenied message="User records are limited to support and administrators." />;
  }

  const manage = state.status === "ready" && canManageUsers(state.me.roles);

  async function save() {
    if (!pending) return;
    setBusy(true);
    const result = await apiFetch(`/api/v1/admin/users/${pending.uid}`, {
      method: "PATCH",
      body: JSON.stringify({ roles: pending.roles, status: pending.status, reason: pending.reason }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setPending(null);
      return;
    }
    setPending(null);
    load();
  }

  async function disable() {
    if (!disableId) return;
    setBusy(true);
    const user = users.find((item) => item.uid === disableId);
    const result = await apiFetch(`/api/v1/admin/users/${disableId}`, {
      method: "PATCH",
      body: JSON.stringify({ roles: user?.roles ?? ["member"], status: "disabled", reason: "Disabled from the users table" }),
    });
    setBusy(false);
    setDisableId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    load();
  }

  const plan = list.search.get("plan") ?? "all";
  const status = list.search.get("status") ?? "";

  return (
    <div>
      <AdminTitle title="Users" lede="Accounts, roles, and whether a plan is active." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminTabs
          tabs={[
            { id: "all", label: "All", count: counts.all },
            { id: "free", label: "Free", count: counts.free },
            { id: "premium", label: "Premium", count: counts.premium },
          ]}
          value={plan}
          onChange={(id) => list.set({ plan: id === "all" ? null : id })}
        />
        <select className="field h-10 w-44" value={status} aria-label="Status" onChange={(event) => list.set({ status: event.target.value })}>
          <option value="">Any status</option>
          {USER_STATUSES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="mt-3">
        <ListBar placeholder="Name, phone, or email" showDates />
      </div>
      {error ? <div className="mt-4"><ErrorState message={error} onRetry={load} /></div> : null}
      {loading && users.length === 0 ? <div className="mt-4"><LoadingState label="Loading users" /></div> : null}
      {!loading && !error && users.length === 0 ? <div className="mt-4"><EmptyState title="No users" body="No accounts match this filter." /></div> : null}
      {users.length > 0 ? (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Phone</th>
                <th className="px-3 py-3 font-medium">Plan</th>
                <th className="px-3 py-3 font-medium">Joined</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.uid} className="border-b border-line last:border-0">
                  <td className="px-3 py-3 font-medium text-ink">{user.displayName}</td>
                  <td className="px-3 py-3">{user.phoneNumber ?? ""}</td>
                  <td className="px-3 py-3">
                    <Pill tone={user.planId === "free" ? "gray" : "green"}>{user.planId === "free" ? "Free" : "Premium"}</Pill>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : ""}</td>
                  <td className="px-3 py-3">
                    <Pill tone={user.status === "active" ? "green" : "red"}>{user.status === "active" ? "Active" : user.status}</Pill>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button type="button" className="btn-quiet h-9 w-9 px-0" aria-label={`View ${user.displayName}`} onClick={() => setView(user)}>
                        <Eye className="h-4 w-4" />
                      </button>
                      {manage ? (
                        <button
                          type="button"
                          className="btn-quiet h-9 w-9 px-0"
                          aria-label={`Edit ${user.displayName}`}
                          onClick={() => setPending({ uid: user.uid, roles: user.roles ?? ["member"], status: user.status, reason: "" })}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      ) : null}
                      {manage && user.status === "active" ? (
                        <button type="button" className="btn-quiet h-9 w-9 px-0 text-loss" aria-label={`Disable ${user.displayName}`} onClick={() => setDisableId(user.uid)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {!loading && !error ? <ListPager total={total} page={list.page} pageSize={list.pageSize} /> : null}
      {view ? (
        <section className="card mt-4 text-sm">
          <h2 className="font-semibold text-ink">{view.displayName}</h2>
          <p className="mt-2 text-muted">Email {view.email ?? "none"}</p>
          <p className="text-muted">Phone {view.phoneNumber ?? "none"}</p>
          <p className="text-muted">Plan {view.planId} ({view.planStatus})</p>
          {view.roles ? <p className="text-muted">Roles {view.roles.join(", ")}</p> : null}
          <button type="button" className="btn-secondary mt-3" onClick={() => setView(null)}>Close</button>
        </section>
      ) : null}
      {pending ? (
        <form
          className="card mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h2 className="font-semibold text-ink">Edit roles</h2>
          <div className="flex flex-wrap gap-3 text-sm">
            {ROLES.map((role) => (
              <label key={role} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pending.roles.includes(role)}
                  onChange={(event) => {
                    const roles = event.target.checked ? [...pending.roles, role] : pending.roles.filter((item) => item !== role);
                    setPending({ ...pending, roles });
                  }}
                />
                {role}
              </label>
            ))}
          </div>
          <select className="field max-w-xs" value={pending.status} onChange={(event) => setPending({ ...pending, status: event.target.value as UserStatus })}>
            {USER_STATUSES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <input className="field" placeholder="Reason" value={pending.reason} onChange={(event) => setPending({ ...pending, reason: event.target.value })} required />
          <div className="flex gap-2">
            <button className="btn-primary" type="submit" disabled={busy}>Save</button>
            <button className="btn-secondary" type="button" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </form>
      ) : null}
      {disableId ? (
        <ConfirmDialog
          title="Disable this account?"
          body="The account stays in the directory with status disabled. This does not delete the audit history."
          confirmLabel="Disable"
          busy={busy}
          onCancel={() => setDisableId(null)}
          onConfirm={() => void disable()}
        />
      ) : null}
    </div>
  );
}
