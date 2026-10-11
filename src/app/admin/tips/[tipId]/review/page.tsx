"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ConfirmDialog, ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/money";
import { canPublishTips } from "@/server/authorization/roles";
import { PUBLISH_CHECKLIST } from "@/server/tips/lifecycle";
import type { TipRecord } from "@/types/domain";

const CHECK_LABELS: Record<(typeof PUBLISH_CHECKLIST)[number], string> = {
  fields_validated: "Required fields were checked",
  risk_disclosure_present: "The current risk disclosure is attached",
  category_rules_checked: "Category rules, including options fields, were checked",
};

export default function ReviewPage() {
  return (
    <AppFrame admin>
      <Review />
    </AppFrame>
  );
}

function Review() {
  const params = useParams<{ tipId: string }>();
  const router = useRouter();
  const { state } = useAuth();
  const [tip, setTip] = useState<TipRecord | null>(null);
  const [checks, setChecks] = useState<string[]>([]);
  const [reason, setReason] = useState("Reviewed");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiFetch<{ tip: TipRecord }>(`/api/v1/admin/tips/${params.tipId}`).then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setTip(result.data.tip);
    });
  }, [params.tipId]);

  if (state.status === "ready" && !canPublishTips(state.me.roles)) {
    return <PermissionDenied message="Only a publisher can publish." />;
  }
  if (error && !tip) return <ErrorState message={error} />;
  if (!tip) return <LoadingState />;

  async function publish() {
    if (!tip) return;
    setBusy(true);
    const result = await apiFetch(`/api/v1/admin/tips/${tip.id}/publish`, {
      method: "POST",
      headers: { "idempotency-key": `pub_${tip.id}_${tip.version}_${crypto.randomUUID().slice(0, 8)}` },
      body: JSON.stringify({ expectedVersion: tip.version, reason, reviewChecklist: checks }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setOpen(false);
      return;
    }
    router.push(`/admin/tips/${tip.id}`);
  }

  return (
    <div>
      <Link href={`/admin/tips/${tip.id}`} className="text-sm text-muted">Back to tip</Link>
      <h1 className="mt-2 text-2xl font-semibold">Review {tip.symbol}</h1>
      <div className="card mt-4 text-sm tabular-nums">
        <p>{tip.side} · {tip.accessTier} · {tip.timeframe}</p>
        <p>Entry {formatPrice(tip.entryMin)} · SL {formatPrice(tip.stopLoss)}</p>
        <p className="mt-2 whitespace-pre-wrap font-sans">{tip.thesis}</p>
      </div>
      <fieldset className="mt-4 space-y-2">
        <legend className="text-sm font-semibold">Checklist</legend>
        {PUBLISH_CHECKLIST.map((item) => (
          <label key={item} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={checks.includes(item)}
              onChange={(event) => {
                setChecks((current) => event.target.checked ? [...current, item] : current.filter((value) => value !== item));
              }}
            />
            {CHECK_LABELS[item]}
          </label>
        ))}
      </fieldset>
      <label className="mt-4 block">
        <span className="label">Reason</span>
        <input className="field" value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
      <button type="button" className="btn-primary mt-4" onClick={() => setOpen(true)} disabled={tip.status !== "in_review"}>
        Publish
      </button>
      {tip.status !== "in_review" ? <p className="mt-2 text-sm text-muted">Only an in-review tip can be published.</p> : null}
      {open ? (
        <ConfirmDialog
          title="Publish this tip?"
          body="People with access will be able to read it. This writes a publish event and cannot be silently undone."
          confirmLabel="Publish"
          busy={busy}
          onCancel={() => setOpen(false)}
          onConfirm={() => void publish()}
        />
      ) : null}
    </div>
  );
}
