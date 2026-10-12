"use client";

import Link from "next/link";
import { useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ConfirmDialog } from "@/components/states";
import { Chip, PageHeader } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { NotificationSettings } from "@/features/profile/notifications";
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
    <div className="space-y-4">
      <PageHeader title="Profile" lede="Roles and premium access are read from the server. This page cannot grant them." />
      <section className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-ink">{me.displayName || "Member"}</p>
            <p className="mt-1 text-sm text-muted">{me.phoneNumber ?? me.email ?? "No contact linked"}</p>
          </div>
          <Chip tone={me.entitlement.tier === "premium" ? "info" : "neutral"}>{me.entitlement.tier}</Chip>
        </div>
        <dl className="mt-4 divide-y divide-line text-sm">
          <Row label="Status" value={me.status} />
          <Row label="Phone" value={me.phoneNumber ?? "Not linked"} />
          <Row label="Email" value={me.email ?? "Not linked"} />
          <Row label="Sign-in" value={me.providers.join(", ") || "Unknown"} />
          <Row label="Roles" value={me.roles.join(", ")} />
          <Row label="Plan" value={`${me.entitlement.tier} (${me.entitlement.status})`} />
        </dl>
        {canAccessAdmin(me.roles) ? (
          <Link href="/admin" className="btn-secondary mt-4">
            Open admin
          </Link>
        ) : null}
      </section>
      <form className="card space-y-4" onSubmit={save}>
        <h2 className="text-base font-semibold text-ink">Details</h2>
        <label className="block">
          <span className="label" id="name-label">Name</span>
          <input id="name" aria-labelledby="name-label" className="field" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label className="block">
          <span className="label" id="tz-label">Timezone</span>
          <select id="tz" aria-labelledby="tz-label" className="field" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            <option value="Asia/Kolkata">Asia/Kolkata</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
            <option value="UTC">UTC</option>
          </select>
        </label>
        <button className="btn-primary w-full sm:w-auto" type="submit" disabled={busy}>Save</button>
      </form>
      <section className="card space-y-4">
        <h2 className="text-base font-semibold text-ink">Account</h2>
        <label className="block">
          <span className="label" id="reason-label">Reason for disable or deletion</span>
          <textarea id="reason" aria-labelledby="reason-label" className="field min-h-24" value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => void signOutUser()}>Sign out</button>
          <button type="button" className="btn-secondary" onClick={() => setConfirm("disable")}>Disable account</button>
          <button type="button" className="btn-secondary" onClick={() => setConfirm("delete")}>Request deletion</button>
        </div>
        <p className="text-xs leading-5 text-muted">Disable and deletion need a sign-in from the last 15 minutes. Deletion is a request. It does not wipe records that may have to be kept.</p>
      </section>
      <NotificationSettings />
      <div className="flex flex-wrap gap-4 text-sm font-medium">
        <Link href="/referrals" className="text-primary hover:underline">Referral code</Link>
        <Link href="/disclaimer" className="text-primary hover:underline">Risk disclosure</Link>
      </div>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
