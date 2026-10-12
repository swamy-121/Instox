"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ListPager, ListToolbar, useListQuery } from "@/components/list-bar";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Alert = { id: string; title: string; body: string; status: string; url: string; createdAt: string };

export default function NotificationsPage() {
  return (
    <AppFrame requireAuth>
      <Suspense fallback={<LoadingState label="Loading notifications" />}>
        <Body />
      </Suspense>
    </AppFrame>
  );
}

function Body() {
  const list = useListQuery();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    apiFetch<{ alerts: Alert[]; total: number }>(`/api/v1/notifications/history?${list.queryString(["q", "status", "from", "to"])}`).then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setAlerts(result.data.alerts);
      setTotal(result.data.total);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.search]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Notifications</h1>
        <Link href="/settings" className="text-sm font-medium text-primary">Preferences</Link>
      </div>
      <ListToolbar
        placeholder="Title or message"
        filters={[
          { kind: "select", name: "status", label: "Status", empty: "Any status", options: [
            { value: "sent", label: "Sent" },
            { value: "failed", label: "Failed" },
            { value: "queued", label: "Queued" },
          ] },
          { kind: "dates" },
        ]}
      />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!alerts && !error ? <LoadingState label="Loading notifications" /> : null}
      {alerts && alerts.length === 0 ? <EmptyState title="No alerts" body="Alerts sent to this account's devices show up here." /> : null}
      <ul className="space-y-2">
        {alerts?.map((alert) => (
          <li key={alert.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-ink">{alert.title}</p>
              <p className="text-xs text-muted">{alert.status}</p>
            </div>
            <p className="mt-1 text-sm text-muted">{alert.body}</p>
          </li>
        ))}
      </ul>
      {alerts ? <ListPager total={total} page={list.page} pageSize={list.pageSize} /> : null}
    </div>
  );
}
