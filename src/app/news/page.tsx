"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { FilterChip } from "@/components/design";
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
    <div className="space-y-3">
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!payload && !error ? <LoadingState label="Loading news" /> : null}
      <div className="flex gap-2 overflow-x-auto">
        {categories.map((item) => (
          <FilterChip key={item} active={item === category} onClick={() => setCategory(item)}>{item}</FilterChip>
        ))}
      </div>
      {payload && rows.length === 0 ? <EmptyState title="No stories" body="No news yet. Check back soon." /> : null}
      <ul className="card divide-y divide-line !p-0">
        {rows.map((row) => (
          <li key={row.id} className="px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{row.category}</p>
            <h2 className="mt-1 text-[15px] font-semibold text-ink">{row.title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{row.summary}</p>
            <p className="mt-1 text-[11px] text-muted">{row.source} · {new Date(row.publishedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
