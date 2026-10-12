"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { OperationsGate } from "@/components/operations-gate";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Field = { key: string; label: string; type: "text" | "number" | "bool" | "lines" | "json" };

const SPECS: Record<string, { title: string; fields: Field[] }> = {
  indices: { title: "Indices and quotes", fields: [
    { key: "symbol", label: "Symbol", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "last", label: "Last", type: "number" },
    { key: "changePct", label: "Change %", type: "number" },
    { key: "kind", label: "Kind (index or stock)", type: "text" },
    { key: "sort", label: "Sort", type: "number" },
  ] },
  newsArticles: { title: "News", fields: [
    { key: "title", label: "Title", type: "text" },
    { key: "summary", label: "Summary", type: "lines" },
    { key: "source", label: "Source", type: "text" },
    { key: "category", label: "Category", type: "text" },
    { key: "publishedAt", label: "Published at", type: "text" },
    { key: "status", label: "Status (published or draft)", type: "text" },
    { key: "sort", label: "Sort", type: "number" },
  ] },
  helpArticles: { title: "Help", fields: [
    { key: "question", label: "Question", type: "text" },
    { key: "answer", label: "Answer", type: "lines" },
    { key: "status", label: "Status (published or draft)", type: "text" },
    { key: "sort", label: "Sort", type: "number" },
  ] },
  shopProducts: { title: "Shop", fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "description", label: "Description", type: "lines" },
    { key: "priceMinor", label: "Price in paise", type: "number" },
    { key: "currency", label: "Currency", type: "text" },
    { key: "active", label: "Active", type: "bool" },
    { key: "approved", label: "Approved", type: "bool" },
    { key: "fulfillment", label: "Fulfilment", type: "text" },
    { key: "sort", label: "Sort", type: "number" },
  ] },
  onboardingSlides: { title: "Onboarding", fields: [
    { key: "title", label: "Title", type: "text" },
    { key: "body", label: "Body", type: "lines" },
    { key: "icon", label: "Icon (chart, search, or news)", type: "text" },
    { key: "sort", label: "Sort", type: "number" },
  ] },
  paymentMethods: { title: "Payment methods", fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "detail", label: "Detail", type: "text" },
    { key: "active", label: "Active", type: "bool" },
    { key: "sort", label: "Sort", type: "number" },
  ] },
  plans: { title: "Plans", fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "description", label: "Description", type: "lines" },
    { key: "priceMinor", label: "Price in paise", type: "number" },
    { key: "currency", label: "Currency", type: "text" },
    { key: "billingPeriod", label: "Billing period", type: "text" },
    { key: "features", label: "Features, one per line", type: "lines" },
    { key: "active", label: "Active", type: "bool" },
    { key: "approved", label: "Approved", type: "bool" },
    { key: "effectiveFrom", label: "Effective from", type: "text" },
    { key: "taxTreatment", label: "Tax treatment", type: "text" },
    { key: "placeholder", label: "Placeholder", type: "bool" },
    { key: "listed", label: "Listed", type: "bool" },
    { key: "mostPopular", label: "Most popular", type: "bool" },
    { key: "accessDays", label: "Access days", type: "number" },
  ] },
  advertisements: { title: "Advertisements", fields: [
    { key: "title", label: "Title", type: "text" },
    { key: "body", label: "Body", type: "lines" },
    { key: "placement", label: "Placement", type: "text" },
    { key: "status", label: "Status (published or draft)", type: "text" },
    { key: "sort", label: "Sort", type: "number" },
  ] },
  contentDocs: { title: "Copy", fields: [
    { key: "title", label: "Title", type: "text" },
    { key: "body", label: "Body", type: "lines" },
    { key: "kind", label: "Kind (splash, support, or note)", type: "text" },
  ] },
  homeTiles: { title: "Home tiles", fields: [
    { key: "href", label: "Path", type: "text" },
    { key: "label", label: "Label", type: "text" },
    { key: "icon", label: "Icon", type: "text" },
    { key: "status", label: "Status (published or draft)", type: "text" },
    { key: "sort", label: "Sort", type: "number" },
  ] },
  moreLinks: { title: "More menu", fields: [
    { key: "href", label: "Path", type: "text" },
    { key: "label", label: "Label", type: "text" },
    { key: "status", label: "Status (published or draft)", type: "text" },
    { key: "sort", label: "Sort", type: "number" },
  ] },
  watchlistDefaults: { title: "Watchlist defaults", fields: [
    { key: "symbol", label: "Symbol", type: "text" },
    { key: "status", label: "Status (published or draft)", type: "text" },
    { key: "sort", label: "Sort", type: "number" },
  ] },
  notificationTemplates: { title: "Notification templates", fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "title", label: "Title", type: "text" },
    { key: "body", label: "Body", type: "lines" },
    { key: "kind", label: "Kind (tip, marketing, or reminder)", type: "text" },
    { key: "status", label: "Status (published or draft)", type: "text" },
    { key: "sort", label: "Sort", type: "number" },
  ] },
  candleSeries: { title: "Candle series", fields: [
    { key: "symbol", label: "Symbol", type: "text" },
    { key: "candles", label: "Candles JSON", type: "json" },
  ] },
};

function blank(collection: string): Record<string, string> {
  const fields = SPECS[collection]?.fields ?? [];
  const form: Record<string, string> = { id: "" };
  for (const field of fields) {
    if (field.type === "bool") form[field.key] = "false";
    else if (field.key === "fulfillment") form[field.key] = "unconfigured";
    else if (field.key === "currency") form[field.key] = "INR";
    else if (field.key === "status") form[field.key] = "draft";
    else if (field.key === "icon" && collection === "homeTiles") form[field.key] = "tips";
    else if (field.key === "icon") form[field.key] = "chart";
    else if (field.key === "href") form[field.key] = "/tips";
    else if (field.key === "kind" && collection === "notificationTemplates") form[field.key] = "reminder";
    else if (field.key === "kind" && collection === "contentDocs") form[field.key] = "note";
    else if (field.key === "kind") form[field.key] = "stock";
    else form[field.key] = "";
  }
  return form;
}

function fromRecord(collection: string, record: Record<string, unknown>): Record<string, string> {
  const form = blank(collection);
  form.id = String(record.id ?? "");
  for (const field of SPECS[collection]?.fields ?? []) {
    const value = record[field.key];
    if (field.type === "lines" && Array.isArray(value)) form[field.key] = value.join("\n");
    else if (field.type === "json") form[field.key] = JSON.stringify(value ?? [], null, 2);
    else if (field.type === "bool") form[field.key] = value === true ? "true" : "false";
    else if (value != null) form[field.key] = String(value);
  }
  return form;
}

function toPayload(collection: string, form: Record<string, string>): Record<string, unknown> {
  const payload: Record<string, unknown> = { id: form.id.trim() };
  for (const field of SPECS[collection]?.fields ?? []) {
    const raw = form[field.key] ?? "";
    if (field.type === "number") {
      if (raw.trim() === "") continue;
      payload[field.key] = Number(raw);
    } else if (field.type === "bool") payload[field.key] = raw === "true";
    else if (field.type === "lines") {
      const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
      payload[field.key] = field.key === "summary" || field.key === "description" || field.key === "answer" || field.key === "body" ? lines.join("\n") : lines;
    } else if (field.type === "json") payload[field.key] = JSON.parse(raw || "[]");
    else payload[field.key] = raw;
  }
  return payload;
}

export default function AdminContentPage() {
  const params = useParams<{ collection: string }>();
  return (
    <AppFrame admin>
      <OperationsGate>
        <Editor collection={params.collection} />
      </OperationsGate>
    </AppFrame>
  );
}

function Editor({ collection }: { collection: string }) {
  const spec = SPECS[collection];
  const [records, setRecords] = useState<Record<string, unknown>[] | null>(null);
  const [form, setForm] = useState<Record<string, string>>(() => blank(collection));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    setError(null);
    apiFetch<{ records: Record<string, unknown>[] }>(`/api/v1/admin/content/${collection}`).then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setRecords(result.data.records);
    });
  }

  useEffect(() => {
    setForm(blank(collection));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    let payload: Record<string, unknown>;
    try {
      payload = toPayload(collection, form);
    } catch {
      setError("The JSON field could not be parsed.");
      return;
    }
    const result = await apiFetch(`/api/v1/admin/content/${collection}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage("Saved.");
    setForm(blank(collection));
    load();
  }

  async function remove(id: string) {
    const result = await apiFetch(`/api/v1/admin/content/${collection}/${id}`, { method: "DELETE" });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    load();
  }

  if (!spec) return <ErrorState message="This collection has no editor yet." />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">{spec.title}</h1>
      <p className="text-sm text-muted">Records are stored in the database. Saving again with the same id replaces that row.</p>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {message ? <p className="text-sm text-ink" role="status">{message}</p> : null}
      {!records && !error ? <LoadingState label="Loading records" /> : null}
      {records && records.length === 0 ? <EmptyState title="No records" body="Add the first row with the form." /> : null}
      <ul className="space-y-2">
        {records?.map((record) => (
          <li key={String(record.id)} className="card flex items-center justify-between gap-3">
            <button type="button" className="text-left" onClick={() => setForm(fromRecord(collection, record))}>
              <span className="block font-medium text-ink">{String(record.name ?? record.title ?? record.question ?? record.symbol ?? record.id)}</span>
              <span className="text-xs text-muted">{String(record.id)}</span>
            </button>
            <button type="button" className="text-sm text-loss" onClick={() => void remove(String(record.id))}>Delete</button>
          </li>
        ))}
      </ul>
      <form className="card space-y-3" onSubmit={(event) => void save(event)}>
        <label className="block">
          <span className="label">Id</span>
          <input className="field" value={form.id ?? ""} onChange={(event) => setForm({ ...form, id: event.target.value })} required />
        </label>
        {spec.fields.map((field) => (
          <label key={field.key} className="block">
            <span className="label">{field.label}</span>
            {field.type === "bool" ? (
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={form[field.key] === "true"} onChange={(event) => setForm({ ...form, [field.key]: event.target.checked ? "true" : "false" })} />
            ) : field.type === "lines" || field.type === "json" ? (
              <textarea className="field min-h-24" value={form[field.key] ?? ""} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} />
            ) : (
              <input className="field" value={form[field.key] ?? ""} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} />
            )}
          </label>
        ))}
        <button className="btn-primary" type="submit">Save record</button>
      </form>
    </div>
  );
}
