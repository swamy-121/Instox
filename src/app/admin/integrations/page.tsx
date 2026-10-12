"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTabs, AdminTitle, Pill } from "@/components/admin-ui";
import { SuperAdminGate } from "@/components/super-admin-gate";
import { ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";
import {
  fieldsForTab,
  INTEGRATION_TABS,
  tabSelection,
  type IntegrationSchemaField,
  type IntegrationTab,
} from "@/server/integrations/fields";

type FieldView = {
  key: string;
  source: "stored" | "env" | "missing" | "unreadable";
  masked: string;
  value?: string;
};

export default function IntegrationsPage() {
  return (
    <AppFrame admin>
      <SuperAdminGate>
        <Body />
      </SuperAdminGate>
    </AppFrame>
  );
}

function Body() {
  const [views, setViews] = useState<FieldView[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [clear, setClear] = useState<Record<string, boolean>>({});
  const [encryptionReady, setEncryptionReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [tabId, setTabId] = useState(INTEGRATION_TABS[0]?.id ?? "payments");
  const [picked, setPicked] = useState<Record<string, string>>({});

  function apply(next: FieldView[], ready: boolean) {
    setViews(next);
    setEncryptionReady(ready);
    const enums: Record<string, string> = {};
    for (const tab of INTEGRATION_TABS) {
      for (const field of tab.fields) {
        if (field.secret) continue;
        const saved = next.find((view) => view.key === field.key)?.value ?? "";
        enums[field.key] = field.options
          ? (field.options.some((option) => option.value === saved) ? saved : (field.options[0]?.value ?? ""))
          : saved;
      }
    }
    setDrafts(enums);
    setClear({});
  }

  function load() {
    apiFetch<{ fields: FieldView[]; encryptionReady: boolean }>("/api/v1/admin/integrations").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      apply(result.data.fields, result.data.encryptionReady);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tab = INTEGRATION_TABS.find((item) => item.id === tabId) ?? INTEGRATION_TABS[0];
  const provider = views?.find((view) => view.key === "PAYMENTS_PROVIDER")?.value;
  const selection = tab ? tabSelection(tab, picked[tab.id] ?? provider) : "";
  const testId = tab?.selector?.options.find((option) => option.value === selection)?.test ?? tab?.test ?? "";
  const visible = tab ? fieldsForTab(tab, selection) : [];

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const values: Record<string, string> = {};
    for (const item of INTEGRATION_TABS) {
      for (const field of item.fields) {
        const value = drafts[field.key] ?? "";
        if (field.secret) {
          if (value) values[field.key] = value;
        } else {
          values[field.key] = value;
        }
      }
    }
    const result = await apiFetch<{ fields: FieldView[]; encryptionReady: boolean }>("/api/v1/admin/integrations", {
      method: "PUT",
      body: JSON.stringify({ values, clear: Object.keys(clear).filter((key) => clear[key]) }),
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    apply(result.data.fields, result.data.encryptionReady);
    setMessage("Saved. Blank secret boxes were left unchanged.");
  }

  async function test(group: string) {
    setTests((current) => ({ ...current, [group]: "Testing" }));
    const result = await apiFetch<{ ok: boolean; message: string }>("/api/v1/admin/integrations/test", {
      method: "POST",
      body: JSON.stringify({ integration: group }),
    });
    setTests((current) => ({ ...current, [group]: result.ok ? result.data.message : result.message }));
  }

  return (
    <form onSubmit={(event) => void save(event)}>
      <AdminTitle
        title="Integrations"
        lede="Secrets are encrypted in the database and are not sent back to this browser. Leave a box blank to keep the saved value. Firebase project settings and the Admin service account stay in the server environment."
        action={<button className="btn-primary" type="submit" disabled={busy}>{busy ? "Saving" : "Save"}</button>}
      />
      {!encryptionReady ? (
        <p className="mb-4 rounded-xl bg-[#FDECEC] px-4 py-3 text-sm text-loss" role="status">
          Set INTEGRATIONS_ENC_KEY on the server before new secrets can be saved.
        </p>
      ) : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!views && !error ? <LoadingState /> : null}
      {message ? <p className="mb-4 text-sm text-ink" role="status">{message}</p> : null}
      {tab ? (
        <>
          <AdminTabs
            tabs={INTEGRATION_TABS.map((item) => ({ id: item.id, label: item.title }))}
            value={tab.id}
            onChange={setTabId}
          />
          <TabPanel
            tab={tab}
            fields={visible}
            views={views ?? []}
            drafts={drafts}
            clear={clear}
            selection={selection}
            testMessage={tests[testId] ?? ""}
            onSelect={(value) => setPicked((current) => ({ ...current, [tab.id]: value }))}
            onDraft={(key, value) => setDrafts({ ...drafts, [key]: value })}
            onClear={(key, checked) => setClear({ ...clear, [key]: checked })}
            onTest={() => void test(testId)}
          />
        </>
      ) : null}
    </form>
  );
}

function TabPanel({
  tab,
  fields,
  views,
  drafts,
  clear,
  selection,
  testMessage,
  onSelect,
  onDraft,
  onClear,
  onTest,
}: {
  tab: IntegrationTab;
  fields: IntegrationSchemaField[];
  views: FieldView[];
  drafts: Record<string, string>;
  clear: Record<string, boolean>;
  selection: string;
  testMessage: string;
  onSelect: (value: string) => void;
  onDraft: (key: string, value: string) => void;
  onClear: (key: string, checked: boolean) => void;
  onTest: () => void;
}) {
  const selected = tab.selector?.options.find((option) => option.value === selection);
  return (
    <section className="card mt-4 space-y-4" role="tabpanel" aria-label={tab.title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">{tab.lede}</p>
        <button type="button" className="btn-secondary" onClick={onTest}>Test connection</button>
      </div>
      {testMessage ? <p className="text-sm text-ink" role="status">{testMessage}</p> : null}
      {tab.selector ? (
        <label className="block max-w-sm">
          <span className="label">{tab.selector.label}</span>
          <select className="field" value={selection} onChange={(event) => onSelect(event.target.value)}>
            {tab.selector.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {selected?.note ? <span className="mt-2 block text-xs text-muted">{selected.note}</span> : null}
        </label>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => {
          const view = views.find((item) => item.key === field.key);
          return (
            <FieldControl
              key={field.key}
              field={field}
              view={view}
              draft={drafts[field.key] ?? ""}
              clear={clear[field.key] === true}
              onDraft={onDraft}
              onClear={onClear}
            />
          );
        })}
      </div>
    </section>
  );
}

function FieldControl({
  field,
  view,
  draft,
  clear,
  onDraft,
  onClear,
}: {
  field: IntegrationSchemaField;
  view?: FieldView;
  draft: string;
  clear: boolean;
  onDraft: (key: string, value: string) => void;
  onClear: (key: string, checked: boolean) => void;
}) {
  const source = view?.source ?? "missing";
  return (
    <div>
      <label className="block">
        <span className="label">{field.label}</span>
        {field.options ? (
          <select className="field" value={draft} onChange={(event) => onDraft(field.key, event.target.value)}>
            {field.options.map((option) => (
              <option key={option.value || "empty"} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : (
          <input
            className="field"
            type={field.secret ? "password" : "text"}
            autoComplete={field.secret ? "new-password" : "off"}
            value={draft}
            placeholder={field.secret ? (view?.masked || "Not set") : undefined}
            onChange={(event) => onDraft(field.key, event.target.value)}
          />
        )}
      </label>
      <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Pill tone={source === "stored" ? "green" : source === "unreadable" ? "red" : "gray"}>
          {source === "stored" ? "Saved" : source === "env" ? "Environment" : source === "unreadable" ? "Unreadable" : "Not set"}
        </Pill>
        {field.secret && view?.masked ? <span>{view.masked}</span> : null}
        {source === "stored" ? (
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={clear} onChange={(event) => onClear(field.key, event.target.checked)} />
            Clear saved value
          </label>
        ) : null}
      </span>
    </div>
  );
}
