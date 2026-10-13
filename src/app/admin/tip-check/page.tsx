"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTitle } from "@/components/admin-ui";
import { OperationsGate } from "@/components/operations-gate";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Usage = {
  total: number;
  today: number;
  note: string;
  bySymbol: Array<{ symbol: string; count: number }>;
  recent: Array<{ id: string; userId: string; symbol: string; side: string; agreement: number; createdAt: string; source: string }>;
};

export default function AdminTipCheckPage() {
  return (
    <AppFrame admin>
      <OperationsGate>
        <Body />
      </OperationsGate>
    </AppFrame>
  );
}

function Body() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<Usage>("/api/v1/admin/tip-checks").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setUsage(result.data);
    });
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <AdminTitle title="Tip check usage" lede="How often members use Check a stock. The number they see is agreement between checks, not a chance of profit." />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!usage && !error ? <LoadingState label="Loading usage" /> : null}
      {usage ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3">
              <p className="text-xs text-muted">Today</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{usage.today}</p>
            </div>
            <div className="card p-3">
              <p className="text-xs text-muted">Recent total</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{usage.total}</p>
            </div>
          </div>
          <p className="text-sm text-muted">{usage.note}</p>
          {usage.bySymbol.length === 0 ? <EmptyState title="No checks yet" body="Usage will show up after a member checks a symbol." /> : null}
          {usage.bySymbol.length > 0 ? (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Symbol</th>
                    <th className="px-4 py-3 font-medium">Checks</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.bySymbol.map((row) => (
                    <tr key={row.symbol} className="border-t border-line">
                      <td className="px-4 py-3 font-medium text-ink">{row.symbol}</td>
                      <td className="px-4 py-3 tabular-nums">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {usage.recent.length > 0 ? (
            <ul className="space-y-2">
              {usage.recent.map((row) => (
                <li key={row.id} className="card text-sm">
                  <span className="font-medium text-ink">{row.symbol}</span>
                  <span className="text-muted"> · {row.side} · agreement {row.agreement} · {row.source}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
