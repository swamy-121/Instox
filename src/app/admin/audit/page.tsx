"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
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
      <AuditLog />
    </AppFrame>
  );
}

function AuditLog() {
  const { state } = useAuth();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    apiFetch<{ logs: AuditRow[] }>("/api/v1/admin/audit").then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError({ message: result.message, code: result.code });
        return;
      }
      setError(null);
      setLogs(result.data.logs);
    });
  }

  useEffect(() => {
    if (state.status === "ready") load();
  }, [state.status]);

  if (state.status === "ready" && !canViewAudit(state.me.roles)) {
    return <PermissionDenied message="The audit log is limited to administrators." />;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <p className="mt-1 text-sm text-muted">Append-only records of role changes, tip actions, and account requests.</p>
      {error?.code === "FORBIDDEN" ? <div className="mt-4"><PermissionDenied message={error.message} /></div> : null}
      {error && error.code !== "FORBIDDEN" ? <div className="mt-4"><ErrorState message={error.message} onRetry={load} /></div> : null}
      {loading ? <div className="mt-4"><LoadingState /></div> : null}
      {!loading && !error && logs.length === 0 ? <div className="mt-4"><EmptyState title="No audit rows" body="Privileged actions will appear here." /></div> : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead>
            <tr className="text-muted">
              <th className="py-2">When</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Reason</th>
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
    </div>
  );
}
