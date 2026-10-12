"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTabs, AdminTitle, Pill } from "@/components/admin-ui";
import { ContentDesk } from "@/features/admin/content-desk";
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { canPublishTips } from "@/server/authorization/roles";

type Campaign = {
  id: string;
  title: string;
  body: string;
  audience: string;
  status: string;
  createdAt: string;
};

type Template = { id: string; name: string; title: string; body: string; status: string };

export default function NotificationsPage() {
  return (
    <AppFrame admin>
      <Body />
    </AppFrame>
  );
}

function Body() {
  const { state } = useAuth();
  const [tab, setTab] = useState("send");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<"all" | "free" | "premium">("all");
  const [rows, setRows] = useState<Campaign[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    apiFetch<{ campaigns: Campaign[] }>("/api/v1/admin/notifications").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setRows(result.data.campaigns);
    });
  }

  useEffect(() => {
    if (state.status !== "ready") return;
    load();
    apiFetch<{ records: Template[] }>("/api/v1/admin/content/notificationTemplates").then((result) => {
      if (result.ok) setTemplates(result.data.records);
    });
  }, [state.status]);

  if (state.status === "ready" && !canPublishTips(state.me.roles)) {
    return <PermissionDenied message="Alerts are limited to publishers and administrators." />;
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const result = await apiFetch<{ notice?: string }>("/api/v1/admin/notifications", {
      method: "POST",
      body: JSON.stringify({ title, message, audience }),
    });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setNotice(result.data.notice ?? "Saved.");
    setTitle("");
    setMessage("");
    load();
    setTab("history");
  }

  return (
    <div>
      <AdminTitle title="Push Notifications" lede="Send a message through FCM. If FCM is not configured, the row is saved and nothing is sent." />
      <AdminTabs
        tabs={[
          { id: "send", label: "Send Notification" },
          { id: "templates", label: "Templates" },
          { id: "history", label: "Notification History" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {error ? <div className="mt-4"><ErrorState message={error} onRetry={load} /></div> : null}
      {tab === "send" ? (
        <form className="card mt-4 max-w-2xl space-y-4" onSubmit={(event) => void send(event)}>
          <label className="block max-w-xs">
            <span className="label">Start from a template</span>
            <select
              className="field"
              value=""
              onChange={(event) => {
                const template = templates.find((row) => row.id === event.target.value);
                if (!template) return;
                setTitle(template.title);
                setMessage(template.body);
              }}
            >
              <option value="">Write a new message</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Title</span>
            <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} maxLength={80} />
          </label>
          <label className="block">
            <span className="label">Message</span>
            <textarea className="field min-h-28" value={message} onChange={(event) => setMessage(event.target.value)} required minLength={3} maxLength={240} />
          </label>
          <label className="block max-w-xs">
            <span className="label">Target Audience</span>
            <select className="field" value={audience} onChange={(event) => setAudience(event.target.value as "all" | "free" | "premium")}>
              <option value="all">All users</option>
              <option value="free">Free users</option>
              <option value="premium">Premium users</option>
            </select>
          </label>
          {notice ? <p className="text-sm text-ink" role="status">{notice}</p> : null}
          <button className="btn-primary" type="submit" disabled={busy}>{busy ? "Sending" : "Send Notification"}</button>
        </form>
      ) : null}
      {tab === "templates" ? (
        <div className="mt-4">
          <ContentDesk
            collection="notificationTemplates"
            title="Templates"
            lede="Reusable title and message. Saving a template does not send it."
            addLabel="Add template"
            columns={[
              { key: "name", label: "Name" },
              { key: "kind", label: "Kind" },
              { key: "status", label: "Status", render: (row) => <Pill tone={row.status === "published" ? "green" : "gray"}>{row.status === "published" ? "Published" : "Draft"}</Pill> },
            ]}
            fields={[
              { key: "name", label: "Name", kind: "text" },
              { key: "title", label: "Title", kind: "text" },
              { key: "kind", label: "Kind", kind: "select", options: [
                { value: "tip", label: "Tip" },
                { value: "marketing", label: "Marketing" },
                { value: "reminder", label: "Reminder" },
              ] },
              { key: "status", label: "Status", kind: "select", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }] },
              { key: "body", label: "Message", kind: "textarea" },
            ]}
            blank={() => ({ id: "", name: "", title: "", body: "", kind: "reminder", status: "draft" })}
            toPayload={(form) => ({
              id: form.id || slug(form.name),
              name: form.name,
              title: form.title,
              body: form.body,
              kind: form.kind === "tip" || form.kind === "marketing" ? form.kind : "reminder",
              status: form.status === "published" ? "published" : "draft",
              sort: Date.now() % 100000,
            })}
          />
        </div>
      ) : null}
      {tab === "history" ? (
        <div className="mt-4">
          {!rows && !error ? <LoadingState /> : null}
          {rows && rows.length === 0 ? <EmptyState title="No alerts yet" body="Sent messages are listed here, including ones FCM did not deliver." /> : null}
          {rows && rows.length > 0 ? (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-3 font-medium">Title</th>
                    <th className="px-3 py-3 font-medium">Audience</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-3">
                        <span className="block font-medium text-ink">{row.title}</span>
                        <span className="block text-xs text-muted">{row.body}</span>
                      </td>
                      <td className="px-3 py-3">{row.audience}</td>
                      <td className="px-3 py-3"><Pill tone={row.status === "skipped_unconfigured" ? "gray" : "green"}>{row.status.replaceAll("_", " ")}</Pill></td>
                      <td className="px-3 py-3 tabular-nums">{row.createdAt ? new Date(row.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function slug(value: string): string {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  return base ? `tpl_${base}` : `tpl_${Date.now().toString(36)}`;
}
