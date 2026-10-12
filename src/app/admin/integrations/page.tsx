"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTitle, Pill } from "@/components/admin-ui";
import { SuperAdminGate } from "@/components/super-admin-gate";
import { ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Field = {
  key: string;
  group: string;
  label: string;
  secret: boolean;
  options?: string[];
  source: "stored" | "env" | "missing" | "unreadable";
  masked: string;
  value?: string;
};

const GROUPS = [
  { id: "payments", title: "Payments", test: "payments", lede: "Choose where checkout is recorded. Remote calls stay off, and live mode stays disabled." },
  { id: "razorpay", title: "Razorpay", test: "razorpay", lede: "Key id, key secret, and webhook secret. A test reads one order list and does not create a charge." },
  { id: "cashfree", title: "Cashfree", test: "cashfree", lede: "Client id, client secret, and webhook secret. A test talks to the sandbox only." },
  { id: "aliceblue", title: "Alice Blue", test: "aliceblue", lede: "App code and API secret for the three index prices. The daily login is still Connect Alice Blue." },
  { id: "fcm", title: "Firebase Cloud Messaging", test: "fcm", lede: "Web push certificate used by the browser. The Firebase Admin service account stays in the server environment." },
];

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
  const [fields, setFields] = useState<Field[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [clear, setClear] = useState<Record<string, boolean>>({});
  const [encryptionReady, setEncryptionReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function apply(next: Field[], ready: boolean) {
    setFields(next);
    setEncryptionReady(ready);
    const enums: Record<string, string> = {};
    for (const field of next) {
      if (field.secret) continue;
      const options = field.options ?? [];
      const value = field.value ?? "";
      enums[field.key] = options.includes(value) ? value : (options[0] ?? "");
    }
    setDrafts(enums);
    setClear({});
  }

  function load() {
    apiFetch<{ fields: Field[]; encryptionReady: boolean }>("/api/v1/admin/integrations").then((result) => {
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

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const values: Record<string, string> = {};
    for (const field of fields ?? []) {
      const value = drafts[field.key] ?? "";
      if (field.secret) {
        if (value) values[field.key] = value;
      } else {
        values[field.key] = value;
      }
    }
    const result = await apiFetch<{ fields: Field[]; encryptionReady: boolean }>("/api/v1/admin/integrations", {
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
        lede="Secrets are encrypted in Firestore and are not sent back to this browser. Leave a box blank to keep the saved value. Firebase project settings and the Admin service account stay in the server environment."
        action={<button className="btn-primary" type="submit" disabled={busy}>{busy ? "Saving" : "Save"}</button>}
      />
      {!encryptionReady ? (
        <p className="mb-4 rounded-xl bg-[#FDECEC] px-4 py-3 text-sm text-loss" role="status">
          Set INTEGRATIONS_ENC_KEY on the server before new secrets can be saved.
        </p>
      ) : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!fields && !error ? <LoadingState /> : null}
      {message ? <p className="mb-4 text-sm text-ink" role="status">{message}</p> : null}
      <div className="space-y-4">
        {GROUPS.map((group) => (
          <section key={group.id} className="card space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink">{group.title}</h2>
                <p className="mt-1 text-sm text-muted">{group.lede}</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => void test(group.test)}>Test connection</button>
            </div>
            {tests[group.id] ? <p className="text-sm text-ink" role="status">{tests[group.id]}</p> : null}
            <div className="grid gap-4 md:grid-cols-2">
              {fields?.filter((field) => field.group === group.id).map((field) => (
                <div key={field.key}>
                  <label className="block">
                  <span className="label">{field.label}</span>
                  {field.secret ? (
                    <input
                      className="field"
                      type="password"
                      autoComplete="new-password"
                      value={drafts[field.key] ?? ""}
                      placeholder={field.masked || "Not set"}
                      onChange={(event) => setDrafts({ ...drafts, [field.key]: event.target.value })}
                    />
                  ) : (
                    <select
                      className="field"
                      value={drafts[field.key] ?? ""}
                      onChange={(event) => setDrafts({ ...drafts, [field.key]: event.target.value })}
                    >
                      {(field.options ?? []).map((option) => (
                        <option key={option || "empty"} value={option}>
                          {option === "" ? "Mock" : option === "dev" ? "Dev quotes" : option}
                        </option>
                      ))}
                    </select>
                  )}
                  </label>
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Pill tone={field.source === "stored" ? "green" : field.source === "unreadable" ? "red" : "gray"}>
                      {field.source === "stored" ? "Saved" : field.source === "env" ? "Environment" : field.source === "unreadable" ? "Unreadable" : "Not set"}
                    </Pill>
                    {field.secret && field.masked ? <span>{field.masked}</span> : null}
                    {field.source === "stored" ? (
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={clear[field.key] === true}
                          onChange={(event) => setClear({ ...clear, [field.key]: event.target.checked })}
                        />
                        Clear saved value
                      </label>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </form>
  );
}
