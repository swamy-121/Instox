"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTabs, AdminTitle, Pill } from "@/components/admin-ui";
import { ListPager, ListToolbar, useListQuery } from "@/components/list-bar";
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { CATEGORY_LABELS, statusLabel } from "@/lib/labels";
import { formatPrice } from "@/lib/money";
import { canEditTips } from "@/server/authorization/roles";
import { TIP_CATEGORIES, TIP_STATUSES, type TipRecord } from "@/types/domain";

const TABS = [
  { id: "", label: "All" },
  ...TIP_CATEGORIES.map((category) => ({
    id: category,
    label: CATEGORY_LABELS[category].replace("Penny stocks", "Penny Stocks").replace("Short-term", "Short Term").replace("Long-term", "Long Term"),
  })),
];

export default function AdminTipsPage() {
  return (
    <AppFrame admin>
      <Suspense fallback={<LoadingState label="Loading tips" />}>
        <TipsDesk />
      </Suspense>
    </AppFrame>
  );
}

function TipsDesk() {
  const { state } = useAuth();
  const list = useListQuery();
  const category = list.search.get("category") ?? "";
  const [tips, setTips] = useState<TipRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const result = await apiFetch<{ tips: TipRecord[]; total: number }>(`/api/v1/admin/tips?${list.queryString(["q", "category", "status", "from", "to"])}`);
    setLoading(false);
    if (!result.ok) {
      setError({ message: result.message, code: result.code });
      return;
    }
    setError(null);
    setTips(result.data.tips);
    setTotal(result.data.total);
  }

  useEffect(() => {
    if (state.status === "ready") void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.search, state.status]);

  if (state.status === "ready" && !canEditTips(state.me.roles)) {
    return <PermissionDenied message="The tip desk is for editors and publishers." />;
  }

  async function remove(id: string) {
    const result = await apiFetch(`/api/v1/admin/tips/${id}`, { method: "DELETE" });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setNotice(null);
    await load();
  }

  return (
    <div>
      <AdminTitle
        title="Trading Tips"
        lede="Drafts, review, and published ideas."
        action={<Link href="/admin/tips/new" className="btn-primary">New idea</Link>}
      />
      <AdminTabs
        tabs={TABS}
        value={category}
        onChange={(id) => list.set({ category: id || null })}
      />
      <div className="mt-3">
        <ListToolbar
          desktop="inline"
          placeholder="Symbol"
          filters={[
            { kind: "select", name: "status", label: "Status", empty: "Any status", options: TIP_STATUSES.map((item) => ({ value: item, label: statusLabel(item, null) })) },
            { kind: "dates" },
          ]}
        />
      </div>
      {notice ? <p className="mt-3 text-sm text-ink" role="status">{notice}</p> : null}
      <div className="mt-4">
        {error?.code === "FORBIDDEN" ? <PermissionDenied message={error.message} /> : null}
        {error && error.code !== "FORBIDDEN" ? <ErrorState message={error.message} onRetry={() => void load()} /> : null}
        {loading && tips.length === 0 ? <LoadingState label="Loading tips" /> : null}
        {!loading && !error && tips.length === 0 ? <EmptyState title="No tips" body="Create a tip to fill this table." /> : null}
        {tips.length > 0 ? (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="px-3 py-3 font-medium">Symbol</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium">Category</th>
                  <th className="px-3 py-3 font-medium">Entry</th>
                  <th className="px-3 py-3 font-medium">Targets</th>
                  <th className="px-3 py-3 font-medium">SL</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tips.map((tip) => (
                  <tr key={tip.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-3 font-semibold text-ink">{tip.symbol}</td>
                    <td className="px-3 py-3">
                      <Pill tone={tip.side === "BUY" ? "green" : "red"}>{tip.side}</Pill>
                    </td>
                    <td className="px-3 py-3">{CATEGORY_LABELS[tip.category]}</td>
                    <td className="px-3 py-3 tabular-nums">{formatPrice(tip.entryMin)}</td>
                    <td className="px-3 py-3 tabular-nums">{tip.targets.map((target) => target.price).join(" / ")}</td>
                    <td className="px-3 py-3 tabular-nums">{formatPrice(tip.stopLoss)}</td>
                    <td className="px-3 py-3">
                      <Pill tone={tip.status === "published" ? "green" : tip.status === "closed" ? "red" : "gray"}>
                        {tip.status === "published" ? "Active" : statusLabel(tip.status, tip.closeReason)}
                      </Pill>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <Link href={`/admin/tips/${tip.id}`} className="btn-quiet h-9 w-9 px-0" aria-label={`Edit ${tip.symbol}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button type="button" className="btn-quiet h-9 w-9 px-0 text-loss" aria-label={`Delete ${tip.symbol}`} onClick={() => void remove(tip.id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!loading && !error ? <ListPager total={total} page={list.page} pageSize={list.pageSize} /> : null}
      </div>
    </div>
  );
}
