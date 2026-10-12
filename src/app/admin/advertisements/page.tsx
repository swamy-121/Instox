"use client";

import { AppFrame } from "@/components/app-frame";
import { Pill } from "@/components/admin-ui";
import { OperationsGate } from "@/components/operations-gate";
import { ContentDesk } from "@/features/admin/content-desk";

export default function AdvertisementsPage() {
  return (
    <AppFrame admin>
      <OperationsGate>
        <ContentDesk
          collection="advertisements"
          title="Advertisements"
          lede="A published row with placement home shows on the member home screen. Ads do not change tip access."
          addLabel="Add Advertisement"
          columns={[
            { key: "title", label: "Title" },
            { key: "placement", label: "Placement", render: (row) => <Pill tone="teal">{String(row.placement ?? "")}</Pill> },
            { key: "status", label: "Status", render: (row) => <Pill tone={row.status === "published" ? "green" : "gray"}>{row.status === "published" ? "Published" : "Draft"}</Pill> },
          ]}
          fields={[
            { key: "title", label: "Title", kind: "text" },
            { key: "placement", label: "Placement", kind: "text" },
            { key: "status", label: "Status", kind: "select", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }] },
            { key: "body", label: "Body", kind: "textarea" },
          ]}
          blank={() => ({ id: "", title: "", placement: "", status: "draft", body: "" })}
          toPayload={(form) => ({
            id: form.id || slug(form.title),
            title: form.title,
            body: form.body,
            placement: form.placement,
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
  return base || `ad_${Date.now().toString(36)}`;
}
