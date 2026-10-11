"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { CATEGORY_LABELS, statusLabel } from "@/lib/labels";
import { canEditTips } from "@/server/authorization/roles";
import { TIP_STATUSES, type TipRecord } from "@/types/domain";

export default function AdminTipsPage() {
  return (
    <AppFrame admin>
      <TipsDesk />
    </AppFrame>
  );
}

function TipsDesk() {
  const { state } = useAuth();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState({ status: "", q: "" });
  const [tips, setTips] = useState<TipRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(next: string | null, replace: boolean) {
    setLoading(true);
    const params = new URLSearchParams({ limit: "20" });
    if (applied.status) params.set("status", applied.status);
    if (applied.q) params.set("q", applied.q);
    if (next) params.set("cursor", next);
    const result = await apiFetch<{ tips: TipRecord[] }>(`/api/v1/admin/tips?${params.toString()}`);
    setLoading(false);
    if (!result.ok) {
      setError({ message: result.message, code: result.code });
      return;
    }
    setError(null);
    setTips((current) => (replace ? result.data.tips : [...current, ...result.data.tips]));
    setCursor(result.nextCursor);
  }

  useEffect(() => {
    if (state.status === "ready") void load(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, state.status]);

  if (state.status === "ready" && !canEditTips(state.me.roles)) {
    return <PermissionDenied message="The tip desk is for editors and publishers." />;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Tips</h1>
        <Link href="/admin/tips/new" className="btn-primary">New draft</Link>
      </div>
      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ status, q });
        }}
      >
        <select className="field max-w-48" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {TIP_STATUSES.map((item) => (
            <option key={item} value={item}>{statusLabel(item)}</option>
          ))}
        </select>
        <input className="field max-w-xs" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Symbol" aria-label="Symbol" />
        <button className="btn-secondary" type="submit">Filter</button>
      </form>
      <div className="mt-4">
        {error?.code === "FORBIDDEN" ? <PermissionDenied message={error.message} /> : null}
        {error && error.code !== "FORBIDDEN" ? <ErrorState message={error.message} onRetry={() => void load(null, true)} /> : null}
        {loading && tips.length === 0 ? <LoadingState /> : null}
        {!loading && !error && tips.length === 0 ? <EmptyState title="No tips" body="Create a draft to start the review queue." /> : null}
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="text-muted">
                <th className="py-2">Symbol</th>
                <th>Category</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {tips.map((tip) => (
                <tr key={tip.id} className="border-t border-line">
                  <td className="py-2 font-medium">
                    <Link href={`/admin/tips/${tip.id}`} className="underline">{tip.symbol}</Link>
                  </td>
                  <td>{CATEGORY_LABELS[tip.category]}</td>
                  <td>{statusLabel(tip.status, tip.closeReason)}</td>
                  <td className="tabular-nums">{new Date(tip.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cursor ? <button type="button" className="btn-secondary mt-4" onClick={() => void load(cursor, false)}>Load more</button> : null}
      </div>
    </div>
  );
}
