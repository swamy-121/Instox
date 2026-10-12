"use client";

import { Suspense, useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ListBar, ListPager, useListQuery } from "@/components/list-bar";
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { canViewAudit } from "@/server/authorization/roles";

type AuditRow = {
  id: string;
  actorUid: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  occurredAt: string;
  requestId: string;
};

export default function AuditPage() {
  return (
    <AppFrame admin>
      <Suspense fallback={<LoadingState label="Loading reports" />}>
        <AuditLog />
      </Suspense>
    </AppFrame>
  );
}

function AuditLog() {
  const { state } = useAuth();
  const list = useListQuery();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    apiFetch<{ logs: AuditRow[]; total: number }>(`/api/v1/admin/audit?${list.queryString(["q", "action", "from", "to"])}`).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError({ message: result.message, code: result.code });
        return;
      }
      setError(null);
      setLogs(result.data.logs);
      setTotal(result.data.total);
    });
  }

  useEffect(() => {
    if (state.status === "ready") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, list.search]);

  if (state.status === "ready" && !canViewAudit(state.me.roles)) {
    return <PermissionDenied message="Reports are limited to administrators." />;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">Reports</h1>
      <p className="mt-1 text-sm text-muted">Audit log of role changes, tip actions, and account requests.</p>
      <div className="mt-4">
        <ListBar placeholder="Action, actor, or target" showDates fields={["action"]} extra={
          <label>
            <span className="label">Action</span>
            <input className="field w-44" name="action" key={list.search.get("action") ?? ""} defaultValue={list.search.get("action") ?? ""} placeholder="tip.publish" aria-label="Action" />
          </label>
        } />
      </div>
      {error?.code === "FORBIDDEN" ? <div className="mt-4"><PermissionDenied message={error.message} /></div> : null}
      {error && error.code !== "FORBIDDEN" ? <div className="mt-4"><ErrorState message={error.message} onRetry={load} /></div> : null}
      {loading ? <div className="mt-4"><LoadingState /></div> : null}
      {!loading && !error && logs.length === 0 ? <div className="mt-4"><EmptyState title="No report rows" body="Privileged actions will appear here." /></div> : null}
      {logs.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-2 font-medium">When</th>
                <th className="font-medium">Action</th>
                <th className="font-medium">Actor</th>
                <th className="font-medium">Target</th>
                <th className="font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-line align-top">
                  <td className="py-2 tabular-nums">{new Date(log.occurredAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                  <td>{log.action}</td>
                  <td>{log.actorUid}</td>
                  <td>{log.targetType}:{log.targetId}</td>
                  <td>{log.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {!loading && !error ? <ListPager total={total} page={list.page} pageSize={list.pageSize} /> : null}
    </div>
  );
}
