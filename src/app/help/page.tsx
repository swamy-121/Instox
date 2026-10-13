"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useMemberConfig } from "@/features/app/member-config";
import { apiFetch } from "@/lib/api-client";

type Article = { id: string; question: string; answer: string };
type Doc = { id: string; title: string; body: string };

export default function HelpPage() {
  return (
    <AppFrame>
      <Body />
    </AppFrame>
  );
}

function Body() {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [support, setSupport] = useState<Doc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const config = useMemberConfig();
  const [open, setOpen] = useState<string | null>(null);

  function load() {
    setError(null);
    Promise.all([
      apiFetch<{ records: Article[] }>("/api/v1/content/helpArticles"),
      apiFetch<{ records: Doc[] }>("/api/v1/content/contentDocs"),
    ]).then(([help, docs]) => {
      if (!help.ok) {
        setError(help.message);
        return;
      }
      setArticles(help.data.records);
      if (docs.ok) setSupport(docs.data.records.find((row) => row.id === "support") ?? null);
    });
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="sr-only">{config.helpTitle}</h1>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!articles && !error ? <LoadingState label="Loading help" /> : null}
      {support ? (
        <section className="card">
          <h2 className="font-semibold text-ink">{support.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{support.body}</p>
        </section>
      ) : null}
      {articles && articles.length === 0 ? <EmptyState title="No articles" body="Help articles will show up here soon." /> : null}
      <ul className="space-y-2">
        {articles?.map((article) => (
          <li key={article.id} className="card">
            <button type="button" className="w-full text-left font-medium text-ink" onClick={() => setOpen(open === article.id ? null : article.id)}>
              {article.question}
            </button>
            {open === article.id ? <p className="mt-2 text-sm leading-6 text-muted">{article.answer}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
