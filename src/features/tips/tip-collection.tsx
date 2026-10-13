"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TipCard } from "@/components/tip-card";
import { apiFetch } from "@/lib/api-client";
import type { TipView } from "@/server/tips/present";

export function TipCollectionPage({
  title,
  lede,
  path,
  emptyTitle,
  emptyBody,
}: {
  title: string;
  lede: string;
  path: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  return (
    <AppFrame requireAuth>
      <Collection title={title} lede={lede} path={path} emptyTitle={emptyTitle} emptyBody={emptyBody} />
    </AppFrame>
  );
}

function Collection({
  title,
  lede,
  path,
  emptyTitle,
  emptyBody,
}: {
  title: string;
  lede: string;
  path: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  const [tips, setTips] = useState<TipView[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    apiFetch<{ tips: TipView[]; note?: string }>(path).then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setTips(result.data.tips);
      setNote(result.data.note ?? null);
    });
  }

  useEffect(() => {
    setError(null);
    apiFetch<{ tips: TipView[]; note?: string }>(path).then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setTips(result.data.tips);
      setNote(result.data.note ?? null);
    });
  }, [path]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted">{lede}</p>
      </header>
      {note ? <p className="text-sm text-muted">{note}</p> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!tips && !error ? <LoadingState label="Loading ideas" /> : null}
      {tips && tips.length === 0 ? <EmptyState title={emptyTitle} body={emptyBody} /> : null}
      <div className="space-y-3">
        {tips?.map((tip) => <TipCard key={tip.id} tip={tip} />)}
      </div>
    </div>
  );
}
