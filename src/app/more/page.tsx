"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { canAccessAdmin } from "@/server/authorization/roles";

type LinkRow = { id: string; href: string; label: string };

export default function MorePage() {
  return (
    <AppFrame requireAuth>
      <MoreBody />
    </AppFrame>
  );
}

function MoreBody() {
  const { state, signOutUser } = useAuth();
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    apiFetch<{ records: LinkRow[] }>("/api/v1/content/moreLinks").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setLinks(result.data.records);
    });
  }

  useEffect(() => {
    if (state.status === "ready") load();
  }, [state.status]);

  if (state.status !== "ready") return null;
  const admin = canAccessAdmin(state.me.roles);
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink">More</h1>
        <p className="text-sm text-muted">{state.me.displayName}</p>
      </header>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!links && !error ? <LoadingState label="Loading menu" /> : null}
      {links && links.length === 0 ? <EmptyState title="No links" body="Publish a More menu row to show it here." /> : null}
      <ul className="card divide-y divide-line p-0">
        {links?.map((link) => (
          <li key={link.id}>
            <Link href={link.href} className="flex items-center justify-between px-4 py-3 text-sm font-medium text-ink">
              {link.label}
              <span aria-hidden="true" className="text-muted">›</span>
            </Link>
          </li>
        ))}
        {admin ? (
          <li>
            <Link href="/admin" className="flex items-center justify-between px-4 py-3 text-sm font-medium text-ink">
              Admin
              <span aria-hidden="true" className="text-muted">›</span>
            </Link>
          </li>
        ) : null}
      </ul>
      <button type="button" className="btn-secondary w-full" onClick={() => void signOutUser()}>Log out</button>
    </div>
  );
}
