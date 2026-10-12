"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ConfirmDialog, ErrorState, LoadingState } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { formFromTip, TipForm, toTipPayload, type TipFormValue } from "@/features/tips/tip-form";
import { apiFetch } from "@/lib/api-client";
import { statusLabel } from "@/lib/labels";
import { canEditTips, canPublishTips } from "@/server/authorization/roles";
import { CLOSE_REASONS, type CloseReason, type TipEvent, type TipRecord } from "@/types/domain";

export default function AdminTipPage() {
  return (
    <AppFrame admin>
      <TipDesk />
    </AppFrame>
  );
}

function TipDesk() {
  const params = useParams<{ tipId: string }>();
  const { state } = useAuth();
  const [tip, setTip] = useState<TipRecord | null>(null);
  const [events, setEvents] = useState<TipEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [closeReason, setCloseReason] = useState<CloseReason>("manually_closed");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "cancel" | "expire" | "close">(null);

  async function load() {
    const result = await apiFetch<{ tip: TipRecord; events: TipEvent[] }>(`/api/v1/admin/tips/${params.tipId}`);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setTip(result.data.tip);
    setEvents(result.data.events);
    setError(null);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tipId]);

  async function save(form: TipFormValue) {
    if (!tip) return;
    setBusy(true);
    const result = await apiFetch<{ tip: TipRecord }>(`/api/v1/admin/tips/${tip.id}`, {
      method: "PATCH",
      body: JSON.stringify({ expectedVersion: tip.version, reason: reason || "Updated draft", tip: toTipPayload(form) }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setFields(result.fields ?? {});
      return;
    }
    setTip(result.data.tip);
    await load();
  }

  async function transition(action: "submit_review" | "return_to_draft" | "close" | "cancel" | "expire") {
    if (!tip) return;
    setBusy(true);
    const result = await apiFetch<{ tip: TipRecord }>(`/api/v1/admin/tips/${tip.id}/transition`, {
      method: "POST",
      body: JSON.stringify({
        action,
        expectedVersion: tip.version,
        reason,
        closeReason: action === "close" ? closeReason : null,
      }),
    });
    setBusy(false);
    setConfirm(null);
    if (!result.ok) {
      setError(result.message);
      setFields(result.fields ?? {});
      return;
    }
    setTip(result.data.tip);
    await load();
  }

  if (error && !tip) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!tip || state.status !== "ready") return <LoadingState />;

  const publisher = canPublishTips(state.me.roles);
  const editor = canEditTips(state.me.roles);
  const editable = tip.status === "draft" || tip.status === "in_review" || (tip.status === "published" && publisher);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">Version {tip.version}</p>
        <h1 className="text-2xl font-semibold">{tip.symbol}</h1>
        <p className="text-sm">Status: {statusLabel(tip.status, tip.closeReason)}</p>
        {tip.status === "in_review" && publisher ? (
          <Link href={`/admin/tips/${tip.id}/review`} className="btn-primary mt-3">
            Review and publish
          </Link>
        ) : null}
      </div>
      {error ? <p className="text-sm text-ink" role="alert">{error}</p> : null}
      <label className="block">
        <span className="label">Reason</span>
        <input className="field" value={reason} onChange={(event) => setReason(event.target.value)} />
        {fields.reason ? <span className="text-sm text-ink">{fields.reason}</span> : null}
      </label>
      {editable ? (
        <TipForm key={tip.version} initial={formFromTip(tip)} fields={fields} busy={busy} submitLabel="Save changes" onSubmit={(form) => void save(form)} />
      ) : (
        <p className="text-sm text-muted">This tip is closed to edits.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {editor && tip.status === "draft" ? (
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void transition("submit_review")}>Submit for review</button>
        ) : null}
        {publisher && tip.status === "in_review" ? (
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void transition("return_to_draft")}>Return to draft</button>
        ) : null}
        {publisher && tip.status === "published" ? (
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirm("close")}>Close</button>
            <button type="button" className="btn-secondary" onClick={() => setConfirm("expire")}>Expire</button>
          </>
        ) : null}
        {(publisher || (editor && tip.status === "draft" && tip.createdBy === state.me.uid)) && (tip.status === "draft" || tip.status === "in_review" || tip.status === "published") ? (
          <button type="button" className="btn-secondary" onClick={() => setConfirm("cancel")}>Cancel tip</button>
        ) : null}
      </div>
      {publisher && tip.status === "published" ? (
        <label className="block max-w-xs">
          <span className="label">Close reason</span>
          <select className="field" value={closeReason} onChange={(event) => setCloseReason(event.target.value as CloseReason)}>
            {CLOSE_REASONS.map((item) => (
              <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
      ) : null}
      <section>
        <h2 className="text-lg font-semibold">Event timeline</h2>
        {events.length === 0 ? <p className="mt-2 text-sm text-muted">No events yet.</p> : null}
        <ol className="mt-3 space-y-3">
          {events.map((event) => (
            <li key={event.id} className="card text-sm">
              <p className="font-medium">{event.eventType.replaceAll("_", " ")}</p>
              <p>State: {event.oldStatus ?? "none"} to {event.newStatus ?? "same"}</p>
              <p>Version: {event.oldVersion ?? "none"} to {event.newVersion ?? "same"}</p>
              <p>Reason: {event.reason}</p>
              <p className="text-muted">Actor {event.actorUid} · {new Date(event.occurredAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
            </li>
          ))}
        </ol>
      </section>
      {confirm ? (
        <ConfirmDialog
          title={`${confirm[0]?.toUpperCase()}${confirm.slice(1)} this tip?`}
          body="The change is written to the event log with your reason. It does not rewrite older events."
          confirmLabel="Confirm"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void transition(confirm)}
        />
      ) : null}
    </div>
  );
}
