"use client";

import { useEffect, useState } from "react";
import { MEMBER_COPY_DEFAULTS, type MemberCopy } from "@/lib/member-copy";
import { apiFetch } from "@/lib/api-client";

const FIELDS: Array<{ key: keyof MemberCopy; label: string; kind: "text" | "textarea" | "bool" }> = [
  { key: "greetingPrefix", label: "Greeting prefix", kind: "text" },
  { key: "greetingSubtitle", label: "Greeting line", kind: "text" },
  { key: "homePicksTitle", label: "Home picks heading", kind: "text" },
  { key: "premiumTitle", label: "Premium heading", kind: "text" },
  { key: "popularBadge", label: "Popular plan badge", kind: "text" },
  { key: "helpTitle", label: "Help heading", kind: "text" },
  { key: "paymentSuccessTitle", label: "Payment success title", kind: "text" },
  { key: "paymentSuccessCta", label: "Payment success button", kind: "text" },
  { key: "paymentSuccessBody", label: "Payment success message", kind: "textarea" },
  { key: "settingsIntro", label: "Settings intro", kind: "textarea" },
  { key: "appVersion", label: "App version", kind: "text" },
  { key: "maintenanceTitle", label: "Maintenance title", kind: "text" },
  { key: "maintenanceBody", label: "Maintenance message", kind: "textarea" },
  { key: "maintenance", label: "Maintenance mode", kind: "bool" },
  { key: "tipPushDefault", label: "Tip alerts on for new accounts", kind: "bool" },
  { key: "marketingPushDefault", label: "Marketing alerts on for new accounts", kind: "bool" },
];

export function MemberCopyForm() {
  const [form, setForm] = useState<MemberCopy>(MEMBER_COPY_DEFAULTS);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ config: MemberCopy }>("/api/v1/admin/app-config").then((result) => {
      if (result.ok) setForm({ ...MEMBER_COPY_DEFAULTS, ...result.data.config });
    });
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await apiFetch("/api/v1/admin/app-config", {
      method: "PUT",
      body: JSON.stringify(form),
    });
    setBusy(false);
    setMessage(result.ok ? "Saved." : result.message);
  }

  return (
    <form className="card mb-6 grid gap-4 md:grid-cols-2" onSubmit={(event) => void save(event)}>
      <div className="md:col-span-2">
        <h2 className="text-base font-semibold text-ink">Member copy</h2>
        <p className="mt-1 text-sm text-muted">
          Greeting, headings, payment success, version, maintenance, and the alert defaults for a new account. Success copy cannot say premium was granted.
        </p>
      </div>
      {FIELDS.map((field) => (
        <label key={field.key} className={field.kind === "textarea" ? "md:col-span-2" : ""}>
          <span className="label">{field.label}</span>
          {field.kind === "bool" ? (
            <select
              className="field"
              value={form[field.key] ? "true" : "false"}
              onChange={(event) => setForm({ ...form, [field.key]: event.target.value === "true" })}
            >
              <option value="false">Off</option>
              <option value="true">On</option>
            </select>
          ) : field.kind === "textarea" ? (
            <textarea
              className="field min-h-24"
              value={String(form[field.key])}
              onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
              required
            />
          ) : (
            <input
              className="field"
              value={String(form[field.key])}
              onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
              required
            />
          )}
        </label>
      ))}
      {message ? <p className="md:col-span-2 text-sm text-ink" role="status">{message}</p> : null}
      <div className="md:col-span-2 flex justify-end">
        <button className="btn-primary" type="submit" disabled={busy}>{busy ? "Saving" : "Save member copy"}</button>
      </div>
    </form>
  );
}
