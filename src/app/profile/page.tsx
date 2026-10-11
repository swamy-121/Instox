"use client";

import Link from "next/link";
import { useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ConfirmDialog } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { canAccessAdmin } from "@/server/authorization/roles";

export default function ProfilePage() {
  return (
    <AppFrame requireAuth>
      <ProfileBody />
    </AppFrame>
  );
}

function ProfileBody() {
  const { state, refresh, signOutUser } = useAuth();
  const [displayName, setDisplayName] = useState(state.status === "ready" ? state.me.displayName : "");
  const [timezone, setTimezone] = useState(state.status === "ready" ? state.me.timezone : "Asia/Kolkata");
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<"disable" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status !== "ready") return null;
  const me = state.me;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await apiFetch("/api/v1/me", {
      method: "PATCH",
      body: JSON.stringify({ displayName, timezone, locale: me.locale }),
    });
    setBusy(false);
    setMessage(result.ok ? "Profile saved." : result.message);
    if (result.ok) await refresh();
  }

  async function runAccountAction() {
    setBusy(true);
    const path = confirm === "delete" ? "/api/v1/account/deletion-requests" : "/api/v1/account/disable";
    const result = await apiFetch(path, { method: "POST", body: JSON.stringify({ reason }) });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      setConfirm(null);
      return;
    }
    if (confirm === "disable") {
      await signOutUser();
      return;
    }
    setConfirm(null);
    setMessage("Deletion request recorded. Access is paused.");
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-muted">Roles and premium access are read from the server. This page cannot grant them.</p>
      </div>
      <section className="card text-sm">
        <p>Status: {me.status}</p>
        <p>Phone: {me.phoneNumber ?? "Not linked"}</p>
        <p>Email: {me.email ?? "Not linked"}</p>
        <p>Sign-in methods: {me.providers.join(", ") || "Unknown"}</p>
        <p>Roles: {me.roles.join(", ")}</p>
        <p>Entitlement: {me.entitlement.tier} ({me.entitlement.status})</p>
        {canAccessAdmin(me.roles) ? (
          <Link href="/admin" className="btn-secondary mt-4">
            Open admin
          </Link>
        ) : null}
      </section>
      <form className="card space-y-3" onSubmit={save}>
        <h2 className="font-semibold">Details</h2>
        <label className="label" htmlFor="name">Name</label>
        <input id="name" className="field" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        <label className="label" htmlFor="tz">Timezone</label>
        <select id="tz" className="field" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
          <option value="Asia/Kolkata">Asia/Kolkata</option>
          <option value="Asia/Dubai">Asia/Dubai</option>
          <option value="UTC">UTC</option>
        </select>
        <button className="btn-primary" type="submit" disabled={busy}>Save</button>
      </form>
      <section className="card space-y-3">
        <h2 className="font-semibold">Account</h2>
        <label className="label" htmlFor="reason">Reason for disable or deletion</label>
        <textarea id="reason" className="field min-h-24" value={reason} onChange={(event) => setReason(event.target.value)} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => void signOutUser()}>Sign out</button>
          <button type="button" className="btn-secondary" onClick={() => setConfirm("disable")}>Disable account</button>
          <button type="button" className="btn-secondary" onClick={() => setConfirm("delete")}>Request deletion</button>
        </div>
        <p className="text-xs text-muted">Disable and deletion need a sign-in from the last 15 minutes. Deletion is a request. It does not wipe records that may have to be kept.</p>
      </section>
      <Link href="/disclaimer" className="text-sm underline">Risk disclosure</Link>
      {message ? <p className="text-sm" role="status">{message}</p> : null}
      {confirm ? (
        <ConfirmDialog
          title={confirm === "delete" ? "Request account deletion?" : "Disable this account?"}
          body={confirm === "delete" ? "Access pauses after the request is stored. An administrator can still see the audit row." : "You will be signed out and blocked until an administrator enables the account."}
          confirmLabel={confirm === "delete" ? "Request deletion" : "Disable"}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void runAccountAction()}
        />
      ) : null}
    </div>
  );
}
