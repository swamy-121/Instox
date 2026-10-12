"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { NewsThumb } from "@/components/illustrations";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Article = { id: string; title: string; summary: string; source: string; category: string; publishedAt: string };
type Payload = { records: Article[] };

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
      <h1 className="text-2xl font-semibold text-ink">Market news</h1>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!payload && !error ? <LoadingState label="Loading news" /> : null}
      <div className="flex gap-2 overflow-x-auto">
        {categories.map((item) => (
          <button key={item} type="button" className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${item === category ? "bg-primary text-white" : "bg-canvas text-ink"}`} onClick={() => setCategory(item)}>
            {item}
          </button>
        ))}
      </div>
      {payload && rows.length === 0 ? <EmptyState title="No stories" body="Publish a news article to fill this list." /> : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="card flex gap-3">
            <NewsThumb category={row.category} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted">{row.category}</p>
              <h2 className="mt-1 font-semibold text-ink">{row.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{row.summary}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
