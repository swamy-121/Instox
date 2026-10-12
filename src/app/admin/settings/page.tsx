"use client";

import { AppFrame } from "@/components/app-frame";
import { OperationsGate } from "@/components/operations-gate";
import { ContentDesk } from "@/features/admin/content-desk";
import { MemberCopyForm } from "@/features/admin/member-copy-form";

export default function SettingsPage() {
  return (
    <AppFrame admin>
      <OperationsGate>
        <MemberCopyForm />
        <ContentDesk
          collection="contentDocs"
          title="Notes"
          lede="Support text and internal notes. The splash screen uses the approved artwork, so a splash note is not drawn on it."
          addLabel="Add Setting"
          columns={[
            { key: "title", label: "Title" },
            { key: "kind", label: "Kind" },
            { key: "body", label: "Body" },
          ]}
          fields={[
            { key: "title", label: "Title", kind: "text" },
            { key: "kind", label: "Kind", kind: "select", options: [
              { value: "splash", label: "Splash" },
              { value: "support", label: "Support" },
              { value: "note", label: "Note" },
            ] },
            { key: "body", label: "Body", kind: "textarea" },
          ]}
          blank={() => ({ id: "", title: "", kind: "note", body: "" })}
          toPayload={(form) => ({
            id: form.id || slug(form.title),
            title: form.title,
            body: form.body,
            kind: form.kind === "splash" || form.kind === "support" ? form.kind : "note",
          })}
        />
      </OperationsGate>
    </AppFrame>
  );
}

function slug(value: string): string {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  return base || `doc_${Date.now().toString(36)}`;
}
