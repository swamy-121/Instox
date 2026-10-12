"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
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
  const [pending, setPending] = useState<{ uid: string; roles: Role[]; status: UserStatus; reason: string } | null>(null);
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

  return (
    <div>
      <h1 className="text-2xl font-semibold">Users and roles</h1>
      <p className="mt-1 text-sm text-muted">Support sees masked contact details and cannot change roles. Role changes need a recent sign-in and a reason.</p>
      {error ? <div className="mt-4"><ErrorState message={error} onRetry={load} /></div> : null}
      {loading ? <div className="mt-4"><LoadingState /></div> : null}
      {!loading && users.length === 0 ? <div className="mt-4"><EmptyState title="No users" body="Seed the emulator or wait for the first sign-in." /></div> : null}
      <div className="mt-4 space-y-3">
        {users.map((user) => (
          <UserCard
            key={user.uid}
            user={user}
            manage={manage}
            onSave={(roles, status, reason) => setPending({ uid: user.uid, roles, status, reason })}
          />
        ))}
      </div>
      {pending ? (
        <ConfirmDialog
          title="Save role and status change?"
          body="This is written to the audit log. You cannot change your own roles here."
          confirmLabel="Save"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => void save()}
        />
      ) : null}
    </div>
  );
}

function UserCard({
  user,
  manage,
  onSave,
}: {
  user: AdminUser;
  manage: boolean;
  onSave: (roles: Role[], status: UserStatus, reason: string) => void;
}) {
  const [roles, setRoles] = useState<Role[]>(user.roles ?? []);
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [reason, setReason] = useState("");

  return (
    <article className="card text-sm">
      <h2 className="font-semibold">{user.displayName || user.uid}</h2>
      <p className="text-muted">{user.uid}</p>
      <p>Status: {user.status}</p>
      <p>Email: {user.email ?? "None"}</p>
      <p>Phone: {user.phoneNumber ?? "None"}</p>
      {manage ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-3">
            {ROLES.map((role) => (
              <label key={role} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
                  onChange={(event) => {
                    setRoles((current) => event.target.checked ? [...current, role] : current.filter((item) => item !== role));
                  }}
                />
                {role.replaceAll("_", " ")}
              </label>
            ))}
          </div>
          <label>
            <span className="label">Account status</span>
            <select className="field max-w-xs" value={status} onChange={(event) => setStatus(event.target.value as UserStatus)}>
              {USER_STATUSES.map((item) => (
                <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Reason</span>
            <input className="field" value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <button type="button" className="btn-secondary" onClick={() => onSave(roles, status, reason)}>
            Save with confirmation
          </button>
        </div>
      ) : (
        <p className="mt-2 text-muted">Role editing is hidden for support.</p>
      )}
    </article>
  );
}
