"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Chip } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";

type Article = { id: string; title: string; summary: string; source: string; category: string; publishedAt: string };
type Payload = { records: Article[]; dataLabel: string; live: boolean };

export default function NewsPage() {
  return (
    <AppFrame>
      <NewsBody />
    </AppFrame>
  );
}

function NewsBody() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("All");

  function load() {
    setError(null);
    apiFetch<Payload>("/api/v1/content/newsArticles").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPayload(result.data);
    });
  }

  useEffect(() => {
    load();
  }, []);

  const categories = ["All", ...new Set(payload?.records.map((row) => row.category) ?? [])];
  const rows = payload?.records.filter((row) => category === "All" || row.category === category) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold text-ink">Market news</h1>
        {payload ? <Chip>{payload.live ? "Live" : payload.dataLabel}</Chip> : null}
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!payload && !error ? <LoadingState label="Loading news" /> : null}
      <div className="flex gap-2 overflow-x-auto">
        {categories.map((item) => (
          <button key={item} type="button" className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${item === category ? "bg-primary text-white" : "bg-canvas text-ink"}`} onClick={() => setCategory(item)}>
            {item}
          </button>
        ))}
      </div>
      {payload && rows.length === 0 ? <EmptyState title="No stories" body="Publish a news article to fill this list." /> : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="card">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{row.category} · {row.source}</p>
            <h2 className="mt-1 font-semibold text-ink">{row.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{row.summary}</p>
            <p className="mt-2 text-xs text-muted">{new Date(row.publishedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
