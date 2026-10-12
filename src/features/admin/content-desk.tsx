"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminTabs, AdminTitle, Pager, Pill, usePage } from "@/components/admin-ui";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Row = Record<string, unknown>;

export type DeskField = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "number" | "select";
  options?: Array<{ value: string; label: string }>;
};

export function ContentDesk({
  collection,
  title,
  lede,
  addLabel,
  columns,
  tabField,
  fields,
  blank,
  toPayload,
  fromRow,
}: {
  collection: string;
  title: string;
  lede: string;
  addLabel: string;
  columns: Array<{ key: string; label: string; render?: (row: Row) => React.ReactNode }>;
  tabField?: string;
  fields: DeskField[];
  blank: () => Record<string, string>;
  toPayload: (form: Record<string, string>) => Record<string, unknown>;
  fromRow?: (row: Row) => Record<string, string>;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(blank);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    apiFetch<{ records: Row[] }>(`/api/v1/admin/content/${collection}`).then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setRows(result.data.records);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection]);

  const tabs = useMemo(() => {
    if (!tabField || !rows) return [{ id: "all", label: "All" }];
    const values = [...new Set(rows.map((row) => String(row[tabField] ?? "")).filter(Boolean))];
    return [{ id: "all", label: "All" }, ...values.map((value) => ({ id: value, label: value }))];
  }, [rows, tabField]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (!tabField || tab === "all") return rows;
    return rows.filter((row) => String(row[tabField] ?? "") === tab);
  }, [rows, tab, tabField]);

  const pager = usePage(filtered, 8);

  function edit(row: Row) {
    if (fromRow) {
      setForm({ ...blank(), ...fromRow(row) });
      setOpen(true);
      setMessage(null);
      return;
    }
    const next = blank();
    next.id = String(row.id ?? "");
    for (const field of fields) {
      const value = row[field.key];
      if (value != null) next[field.key] = String(value);
    }
    setForm(next);
    setOpen(true);
    setMessage(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await apiFetch(`/api/v1/admin/content/${collection}`, {
      method: "POST",
      body: JSON.stringify(toPayload(form)),
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setOpen(false);
    setForm(blank());
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

  return (
    <div>
      <AdminTitle
        title={title}
        lede={lede}
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setForm(blank());
              setOpen(true);
              setMessage(null);
            }}
          >
            {addLabel}
          </button>
        }
      />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!rows && !error ? <LoadingState /> : null}
      {rows ? (
        <>
          {tabField ? (
            <AdminTabs
              tabs={tabs}
              value={tabs.some((item) => item.id === tab) ? tab : "all"}
              onChange={(id) => {
                setTab(id);
                pager.setPage(1);
              }}
            />
          ) : null}
          {filtered.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Nothing here yet" body="Add a record and it will show in this table." />
            </div>
          ) : (
            <div className="card mt-4 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    {columns.map((column) => (
                      <th key={column.key} className="px-3 py-3 font-medium">
                        {column.label}
                      </th>
                    ))}
                    <th className="px-3 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.slice.map((row) => (
                    <tr key={String(row.id)} className="border-b border-line last:border-0">
                      {columns.map((column) => (
                        <td key={column.key} className="px-3 py-3 text-ink">
                          {column.render ? column.render(row) : String(row[column.key] ?? "")}
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button type="button" className="btn-quiet h-9 w-9 px-0" aria-label={`Edit ${String(row.id)}`} onClick={() => edit(row)}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" className="btn-quiet h-9 w-9 px-0 text-loss" aria-label={`Delete ${String(row.id)}`} onClick={() => void remove(String(row.id))}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager page={pager.page} pages={pager.pages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
            </div>
          )}
        </>
      ) : null}
      {open ? (
        <form className="card mt-4 grid gap-4 md:grid-cols-2" onSubmit={(event) => void save(event)}>
          <h2 className="md:col-span-2 text-base font-semibold text-ink">{form.id ? "Edit record" : addLabel}</h2>
          {fields.map((field) => (
            <label key={field.key} className={field.kind === "textarea" ? "md:col-span-2" : ""}>
              <span className="label">{field.label}</span>
              {field.kind === "textarea" ? (
                <textarea className="field min-h-28" value={form[field.key] ?? ""} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} required />
              ) : field.kind === "select" ? (
                <select className="field" value={form[field.key] ?? ""} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}>
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="field" inputMode={field.kind === "number" ? "decimal" : undefined} value={form[field.key] ?? ""} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} required />
              )}
            </label>
          ))}
          {message ? (
            <p className="md:col-span-2 text-sm text-ink" role="alert">
              {message}
            </p>
          ) : null}
          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "Saving" : "Save"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function statusPill(value: unknown) {
  const text = String(value ?? "");
  const published = text === "published" || text === "true" || text === "active";
  return <Pill tone={published ? "green" : "gray"}>{published ? (text === "true" || text === "active" ? "Active" : "Published") : text === "false" ? "Hidden" : text === "draft" ? "Draft" : text}</Pill>;
}
