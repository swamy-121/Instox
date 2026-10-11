"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { TipCard } from "@/components/tip-card";
import { apiFetch } from "@/lib/api-client";
import { CATEGORY_LABELS } from "@/lib/labels";
import type { TipView } from "@/server/tips/present";
import { TIP_CATEGORIES } from "@/types/domain";

type Feed = { tips: TipView[]; viewerTier: string };

export default function TipsPage() {
  return (
    <AppFrame>
      <TipsBody />
    </AppFrame>
  );
}

function TipsBody() {
  const [category, setCategory] = useState("");
  const [accessTier, setAccessTier] = useState("");
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState({ category: "", accessTier: "", q: "" });
  const [tips, setTips] = useState<TipView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code: string; requestId?: string } | null>(null);

  async function load(nextCursor: string | null, replace: boolean) {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "10" });
    if (applied.category) params.set("category", applied.category);
    if (applied.accessTier) params.set("accessTier", applied.accessTier);
    if (applied.q) params.set("q", applied.q);
    if (nextCursor) params.set("cursor", nextCursor);
    const result = await apiFetch<Feed>(`/api/v1/tips?${params.toString()}`);
    setLoading(false);
    if (!result.ok) {
      setError({ message: result.message, code: result.code, requestId: result.requestId });
      return;
    }
    setTips((current) => (replace ? result.data.tips : [...current, ...result.data.tips]));
    setCursor(result.nextCursor);
  }

  useEffect(() => {
    void load(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Tips</h1>
      <p className="mt-1 text-sm text-muted">Free tips show prices. Premium tips stay locked unless the server says your plan is active.</p>
      <form
        className="mt-4 grid gap-3 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ category, accessTier, q });
        }}
      >
        <label className="text-sm">
          <span className="label">Category</span>
          <select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All</option>
            {TIP_CATEGORIES.map((item) => (
              <option key={item} value={item}>{CATEGORY_LABELS[item]}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Access</span>
          <select className="field" value={accessTier} onChange={(event) => setAccessTier(event.target.value)}>
            <option value="">All</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
        </label>
        <label className="text-sm md:col-span-2">
          <span className="label">Symbol search</span>
          <input className="field" value={q} onChange={(event) => setQ(event.target.value)} placeholder="RELIANCE" />
        </label>
        <button className="btn-primary md:col-span-4" type="submit">Apply filters</button>
      </form>
      <div className="mt-6 space-y-3">
        {error?.code === "FORBIDDEN" || error?.code === "ACCOUNT_DISABLED" ? <PermissionDenied message={error.message} /> : null}
        {error && error.code !== "FORBIDDEN" && error.code !== "ACCOUNT_DISABLED" ? (
          <ErrorState message={error.message} requestId={error.requestId} onRetry={() => void load(null, true)} />
        ) : null}
        {loading && tips.length === 0 ? <LoadingState /> : null}
        {!loading && !error && tips.length === 0 ? <EmptyState title="No tips match" body="Try another symbol or category, or check back after a tip is published." /> : null}
        {tips.map((tip) => <TipCard key={tip.id} tip={tip} />)}
        {cursor ? (
          <button type="button" className="btn-secondary" onClick={() => void load(cursor, false)} disabled={loading}>
            {loading ? "Loading" : "Load more"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
