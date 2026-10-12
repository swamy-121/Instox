"use client";

import { AppFrame } from "@/components/app-frame";
import { OperationsGate } from "@/components/operations-gate";
import { Pill } from "@/components/admin-ui";
import { ContentDesk } from "@/features/admin/content-desk";

export default function NewsAdminPage() {
  return (
    <AppFrame admin>
      <OperationsGate>
        <ContentDesk
          collection="newsArticles"
          title="Market News"
          lede="Add and manage market news for users."
          addLabel="Add News"
          tabField="category"
          columns={[
            { key: "title", label: "Title" },
            { key: "category", label: "Category", render: (row) => <Pill tone="teal">{String(row.category ?? "")}</Pill> },
            { key: "status", label: "Status", render: (row) => <Pill tone={row.status === "published" ? "green" : "gray"}>{row.status === "published" ? "Published" : "Draft"}</Pill> },
            { key: "publishedAt", label: "Published", render: (row) => new Date(String(row.publishedAt ?? "")).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) },
          ]}
          fields={[
            { key: "title", label: "Title", kind: "text" },
            { key: "category", label: "Category", kind: "text" },
            { key: "source", label: "Source", kind: "text" },
            { key: "status", label: "Status", kind: "select", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }] },
            { key: "summary", label: "Summary", kind: "textarea" },
          ]}
          blank={() => ({ id: "", title: "", category: "", source: "", status: "draft", summary: "" })}
          toPayload={(form) => ({
            id: form.id || slug(form.title),
            title: form.title,
            summary: form.summary,
            source: form.source,
            category: form.category,
            publishedAt: new Date().toISOString(),
            status: form.status === "published" ? "published" : "draft",
            sort: Date.now() % 100000,
          })}
        />
      </OperationsGate>
    </AppFrame>
  );
}

function slug(value: string): string {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  return base || `news_${Date.now().toString(36)}`;
}
