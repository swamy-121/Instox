"use client";

import { AppFrame } from "@/components/app-frame";
import { Pill } from "@/components/admin-ui";
import { OperationsGate } from "@/components/operations-gate";
import { ContentDesk } from "@/features/admin/content-desk";

export default function SupportAdminPage() {
  return (
    <AppFrame admin>
      <OperationsGate>
        <ContentDesk
          collection="helpArticles"
          title="Support"
          lede="Questions and answers shown in the help screen."
          addLabel="Add Article"
          columns={[
            { key: "question", label: "Question" },
            { key: "answer", label: "Answer" },
            { key: "status", label: "Status", render: (row) => <Pill tone={row.status === "published" ? "green" : "gray"}>{row.status === "published" ? "Published" : "Draft"}</Pill> },
          ]}
          fields={[
            { key: "question", label: "Question", kind: "text" },
            { key: "status", label: "Status", kind: "select", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }] },
            { key: "answer", label: "Answer", kind: "textarea" },
          ]}
          blank={() => ({ id: "", question: "", answer: "", status: "published" })}
          toPayload={(form) => ({
            id: form.id || slug(form.question),
            question: form.question,
            answer: form.answer,
            status: form.status === "draft" ? "draft" : "published",
            sort: Date.now() % 100000,
          })}
        />
      </OperationsGate>
    </AppFrame>
  );
}

function slug(value: string): string {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  return base || `help_${Date.now().toString(36)}`;
}
