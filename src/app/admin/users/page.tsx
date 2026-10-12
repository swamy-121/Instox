"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTabs, AdminTitle, Pager, Pill, usePage } from "@/components/admin-ui";
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
      <Users />
    </AppFrame>
  );
}

function Users() {
  const { state } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<AdminUser | null>(null);
  const [pending, setPending] = useState<{ uid: string; roles: Role[]; status: UserStatus; reason: string } | null>(null);
  const [disableId, setDisableId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    apiFetch<{ users: AdminUser[] }>("/api/v1/admin/users").then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setUsers(result.data.users);
    });
  }

  useEffect(() => {
    if (state.status === "ready") load();
  }, [state.status]);

  const filtered = useMemo(() => {
    return users.filter((user) => {
      if (tab === "free" && user.planId !== "free") return false;
      if (tab === "premium" && user.planId === "free") return false;
      if (status && user.status !== status) return false;
      if (!q.trim()) return true;
      const hay = `${user.displayName} ${user.email ?? ""} ${user.phoneNumber ?? ""} ${user.uid}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  }, [q, status, tab, users]);
  const pager = usePage(filtered, 8);

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

  const counts = {
    all: users.length,
    free: users.filter((user) => user.planId === "free").length,
    premium: users.filter((user) => user.planId !== "free").length,
  };

  return (
    <div>
      <AdminTitle title="Users" lede="Manage Instox users and their accounts." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminTabs
          tabs={[
            { id: "all", label: "All Users", count: counts.all },
            { id: "free", label: "Free Users", count: counts.free },
            { id: "premium", label: "Premium Users", count: counts.premium },
          ]}
          value={tab}
          onChange={(id) => {
            setTab(id);
            pager.setPage(1);
          }}
        />
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            pager.setPage(1);
          }}
        >
          <input className="field h-10 w-56" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search by name, phone, email" aria-label="Search users" />
          <select className="field h-10 w-36" value={status} aria-label="Filter" onChange={(event) => setStatus(event.target.value)}>
            <option value="">Filter</option>
            {USER_STATUSES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </form>
      </div>
      {error ? <div className="mt-4"><ErrorState message={error} onRetry={load} /></div> : null}
      {loading && users.length === 0 ? <div className="mt-4"><LoadingState label="Loading users" /></div> : null}
      {!loading && !error && filtered.length === 0 ? <div className="mt-4"><EmptyState title="No users" body="No accounts match this filter." /></div> : null}
      {filtered.length > 0 ? (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Phone</th>
                <th className="px-3 py-3 font-medium">Plan</th>
                <th className="px-3 py-3 font-medium">Joined</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pager.slice.map((user) => (
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
          <Pager page={pager.page} pages={pager.pages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
        </div>
      ) : null}
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
