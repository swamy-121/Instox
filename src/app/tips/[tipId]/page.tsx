"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { apiFetch } from "@/lib/api-client";
import { CATEGORY_LABELS, statusLabel } from "@/lib/labels";
import { formatPrice } from "@/lib/money";
import type { OpenTipView, TipView } from "@/server/tips/present";

function isOpen(tip: TipView): tip is OpenTipView {
  return tip.locked === false;
}

export default function TipDetailPage() {
  return (
    <AppFrame>
      <Detail />
    </AppFrame>
  );
}

function Detail() {
  const params = useParams<{ tipId: string }>();
  const [tip, setTip] = useState<TipView | null>(null);
  const [error, setError] = useState<{ message: string; code: string; requestId?: string } | null>(null);

  function load() {
    setError(null);
    apiFetch<{ tip: TipView }>(`/api/v1/tips/${params.tipId}`).then((result) => {
      if (!result.ok) {
        setError({ message: result.message, code: result.code, requestId: result.requestId });
        return;
      }
      setTip(result.data.tip);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tipId]);

  if (error?.code === "FORBIDDEN" || error?.code === "ACCOUNT_DISABLED") return <PermissionDenied message={error.message} />;
  if (error) return <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />;
  if (!tip) return <LoadingState label="Loading tip" />;

  return (
    <article className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{CATEGORY_LABELS[tip.category]}</p>
      <h1 className="mt-1 text-2xl font-semibold tabular-nums">{tip.symbol}</h1>
      <p className="mt-2 text-sm">Side: {tip.side}</p>
      <p className="text-sm">Status: {statusLabel(tip.status, isOpen(tip) ? tip.closeReason : null)}</p>
      <p className="text-sm text-muted">Timeframe: {tip.timeframe}</p>
      <p className="text-sm text-muted">Published: {tip.publishedAt ? new Date(tip.publishedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "Not published"}</p>
      {tip.locked ? (
        <div className="mt-6 rounded-xl border border-line bg-canvas p-4">
          <h2 className="font-semibold">Premium tip</h2>
          <p className="mt-2 text-sm text-muted">
            Entry, stop, targets, and rationale are not included in this response. Upgrade is a placeholder until payments and the legal review are approved.
          </p>
          <Link href="/pricing" className="btn-primary mt-4">
            View pricing
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-2 text-sm tabular-nums">
          <p>Entry {formatPrice(tip.entryMin)}{tip.entryMax ? ` to ${formatPrice(tip.entryMax)}` : ""}</p>
          <p>Stop loss {formatPrice(tip.stopLoss)}</p>
          {tip.targets.map((target) => (
            <p key={target.label}>{target.label} {formatPrice(target.price)}</p>
          ))}
          {tip.optionType ? <p>Option {tip.optionType} strike {tip.strikePrice} expiry {tip.expiry}</p> : null}
          <h2 className="pt-2 font-semibold">Rationale</h2>
          <p className="whitespace-pre-wrap font-sans">{tip.thesis}</p>
          <p className="text-xs text-muted">Risk disclosure {tip.riskDisclosureVersion}</p>
        </div>
      )}
    </article>
  );
}
