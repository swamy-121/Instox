"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTabs, AdminTitle, Pager, Pill, usePage } from "@/components/admin-ui";
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { CATEGORY_LABELS, statusLabel } from "@/lib/labels";
import { formatPrice } from "@/lib/money";
import { canEditTips } from "@/server/authorization/roles";
import { TIP_CATEGORIES, type TipRecord } from "@/types/domain";

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
  const search = useSearchParams();
  const q = search.get("q") ?? "";
  const [category, setCategory] = useState("");
  const [tips, setTips] = useState<TipRecord[]>([]);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (category) params.set("category", category);
    if (q.trim()) params.set("q", q.trim());
    const result = await apiFetch<{ tips: TipRecord[] }>(`/api/v1/admin/tips?${params.toString()}`);
    setLoading(false);
    if (!result.ok) {
      setError({ message: result.message, code: result.code });
      return;
    }
    setError(null);
    setTips(result.data.tips);
  }

  useEffect(() => {
    if (state.status === "ready") void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, q, state.status]);

  const pager = usePage(tips, 8);

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
        lede="Manage and publish trading tips for Instox users."
        action={<Link href="/admin/tips/new" className="btn-primary">Add New Tip</Link>}
      />
      <AdminTabs
        tabs={TABS}
        value={category}
        onChange={(id) => {
          setCategory(id);
          pager.setPage(1);
        }}
      />
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
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
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
                {pager.slice.map((tip) => (
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
            <Pager page={pager.page} pages={pager.pages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
