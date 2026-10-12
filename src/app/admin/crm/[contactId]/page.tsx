"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTitle, Pill } from "@/components/admin-ui";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { formatInr } from "@/lib/money";
import { canManageCrm } from "@/server/authorization/roles";
import { CRM_STAGES, CRM_STAGE_LABELS, type CrmStage } from "@/server/crm/model";

type Detail = {
  contact: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    stage: string;
    kind: string;
    tags: string[];
    planId: string | null;
  };
  plan: { planId: string | null; status: string | null; renewalAt: string | null; trialEndsAt: string | null };
  payments: Array<{ id: string; amountMinor: number; currency: string; status: string; createdAt: string }>;
  notes: Array<{ id: string; body: string; createdAt: string }>;
  reminders: Array<{ id: string; body: string; dueAt: string; doneAt: string | null }>;
  timeline: Array<{ id: string; kind: string; summary: string; createdAt: string }>;
  calls: Array<{ id: string; status: string; durationSeconds: number | null; recordingUrl: string | null; transcript: string | null; simulated: boolean; createdAt: string }>;
};

export default function CrmContactPage() {
  return (
    <AppFrame admin>
      <Customer />
    </AppFrame>
  );
}

function Customer() {
  const params = useParams<{ contactId: string }>();
  const { state } = useAuth();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [reminder, setReminder] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    apiFetch<Detail>(`/api/v1/admin/crm/${params.contactId}`).then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setDetail(result.data);
      setTags(result.data.contact.tags.join(", "));
    });
  }

  useEffect(() => {
    if (state.status === "ready") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, params.contactId]);

  if (state.status === "ready" && !canManageCrm(state.me.roles)) {
    return <PermissionDenied message="CRM is limited to support and administrators." />;
  }
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!detail) return <LoadingState label="Loading customer" />;

  async function saveStage(stage: string) {
    const result = await apiFetch<Detail>(`/api/v1/admin/crm/${params.contactId}`, {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setDetail(result.data);
  }

  async function saveTags(event: React.FormEvent) {
    event.preventDefault();
    const result = await apiFetch<Detail>(`/api/v1/admin/crm/${params.contactId}`, {
      method: "PATCH",
      body: JSON.stringify({ tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean) }),
    });
    setMessage(result.ok ? "Tags saved." : result.message);
    if (result.ok) setDetail(result.data);
  }

  async function saveNote(event: React.FormEvent) {
    event.preventDefault();
    const result = await apiFetch<Detail>(`/api/v1/admin/crm/${params.contactId}/notes`, {
      method: "POST",
      body: JSON.stringify({ body: note }),
    });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setNote("");
    setDetail(result.data);
  }

  async function saveReminder(event: React.FormEvent) {
    event.preventDefault();
    const result = await apiFetch<Detail>(`/api/v1/admin/crm/${params.contactId}/reminders`, {
      method: "POST",
      body: JSON.stringify({ body: reminder, dueAt: new Date(dueAt).toISOString() }),
    });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setReminder("");
    setDueAt("");
    setDetail(result.data);
  }

  async function done(reminderId: string) {
    const result = await apiFetch<Detail>(`/api/v1/admin/crm/${params.contactId}/reminders/${reminderId}`, { method: "POST" });
    if (result.ok) setDetail(result.data);
  }

  const stage = detail.contact.stage as CrmStage;

  return (
    <div className="space-y-4">
      <Link href="/admin/crm" className="text-sm text-muted">Back to CRM</Link>
      <AdminTitle title={detail.contact.name} lede={`${detail.contact.kind === "lead" ? "Lead" : "Customer"} · ${detail.contact.phone ?? "No phone"}`} />
      {message ? <p className="text-sm text-ink" role="status">{message}</p> : null}
      <section className="card space-y-3">
        <h2 className="text-base font-semibold text-ink">Pipeline</h2>
        <label className="block max-w-xs">
          <span className="label">Stage</span>
          <select className="field" value={detail.contact.stage} onChange={(event) => void saveStage(event.target.value)}>
            {CRM_STAGES.map((item) => <option key={item} value={item}>{CRM_STAGE_LABELS[item]}</option>)}
          </select>
        </label>
        <Pill tone={stage === "churned" ? "red" : stage === "paid" ? "green" : "gray"}>{CRM_STAGE_LABELS[stage] ?? detail.contact.stage}</Pill>
      </section>
      <section className="card space-y-2">
        <h2 className="text-base font-semibold text-ink">Plan and renewal</h2>
        <p className="text-sm text-ink">Plan: {detail.plan.planId ?? "None"}</p>
        <p className="text-sm text-ink">Subscription: {detail.plan.status ?? "None"}</p>
        <p className="text-sm text-ink">Renewal: {detail.plan.renewalAt ? detail.plan.renewalAt.slice(0, 10) : "Not set"}</p>
        <p className="text-sm text-ink">Trial ends: {detail.plan.trialEndsAt ? detail.plan.trialEndsAt.slice(0, 10) : "Not set"}</p>
      </section>
      <section className="card space-y-2">
        <h2 className="text-base font-semibold text-ink">Payments</h2>
        {detail.payments.length === 0 ? <p className="text-sm text-muted">No payments yet.</p> : null}
        <ul className="space-y-1">
          {detail.payments.map((payment) => (
            <li key={payment.id} className="text-sm text-ink">{formatInr(payment.amountMinor)} · {payment.status} · {payment.createdAt.slice(0, 10)}</li>
          ))}
        </ul>
      </section>
      <form className="card space-y-3" onSubmit={(event) => void saveTags(event)}>
        <h2 className="text-base font-semibold text-ink">Tags</h2>
        <input className="field" value={tags} onChange={(event) => setTags(event.target.value)} aria-label="Tags" placeholder="vip, renewal" />
        <button className="btn-secondary" type="submit">Save tags</button>
      </form>
      <form className="card space-y-3" onSubmit={(event) => void saveNote(event)}>
        <h2 className="text-base font-semibold text-ink">Notes</h2>
        <textarea className="field" value={note} onChange={(event) => setNote(event.target.value)} aria-label="Note" />
        <button className="btn-primary" type="submit">Add note</button>
        <ul className="space-y-2">
          {detail.notes.map((item) => (
            <li key={item.id} className="text-sm text-ink">{item.body}<span className="mt-1 block text-xs text-muted">{item.createdAt.slice(0, 16).replace("T", " ")}</span></li>
          ))}
        </ul>
      </form>
      <form className="card space-y-3" onSubmit={(event) => void saveReminder(event)}>
        <h2 className="text-base font-semibold text-ink">Follow-up reminders</h2>
        <input className="field" value={reminder} onChange={(event) => setReminder(event.target.value)} aria-label="Reminder" placeholder="Call about the trial" />
        <input className="field" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} aria-label="Reminder time" />
        <button className="btn-secondary" type="submit">Add reminder</button>
        <ul className="space-y-2">
          {detail.reminders.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 text-sm text-ink">
              <span>{item.body} · {item.dueAt.slice(0, 16).replace("T", " ")}{item.doneAt ? " · done" : ""}</span>
              {item.doneAt ? null : <button type="button" className="btn-quiet" onClick={() => void done(item.id)}>Done</button>}
            </li>
          ))}
        </ul>
      </form>
      <section className="card space-y-2">
        <h2 className="text-base font-semibold text-ink">Calls</h2>
        {detail.calls.length === 0 ? <p className="text-sm text-muted">No calls yet.</p> : null}
        {detail.calls.map((call) => (
          <article key={call.id} className="rounded-xl border border-line p-3 text-sm text-ink">
            <p>{call.status}{call.simulated ? " · simulated" : ""}{call.durationSeconds != null ? ` · ${call.durationSeconds}s` : ""}</p>
            {call.recordingUrl ? <a className="text-primary underline" href={call.recordingUrl}>Recording</a> : null}
            {call.transcript ? <p className="mt-2 whitespace-pre-wrap text-muted">{call.transcript}</p> : null}
          </article>
        ))}
      </section>
      <section className="card space-y-2">
        <h2 className="text-base font-semibold text-ink">Activity</h2>
        <ul className="space-y-2">
          {detail.timeline.map((item) => (
            <li key={item.id} className="text-sm text-ink">
              <span className="text-xs uppercase text-muted">{item.kind}</span>
              <span className="mt-1 block">{item.summary}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
