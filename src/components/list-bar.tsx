"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PAGE_SIZES, pageButtons } from "@/lib/list-page";

export function useListQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const rawSize = Number(search.get("pageSize") ?? "20");
  const pageSize = PAGE_SIZES.includes(rawSize as (typeof PAGE_SIZES)[number]) ? rawSize : 20;
  const rawPage = Number(search.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  function replace(next: URLSearchParams) {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(search.toString());
    let resetPage = false;
    for (const [key, value] of Object.entries(patch)) {
      if (key !== "page") resetPage = true;
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete("page");
    replace(next);
  }

  function setPage(value: number) {
    const next = new URLSearchParams(search.toString());
    if (value <= 1) next.delete("page");
    else next.set("page", String(value));
    replace(next);
  }

  function queryString(keys: string[]): string {
    const next = new URLSearchParams();
    next.set("page", String(page));
    next.set("pageSize", String(pageSize));
    for (const key of keys) {
      const value = search.get(key);
      if (value) next.set(key, value);
    }
    return next.toString();
  }

  return { search, page, pageSize, q: search.get("q") ?? "", set, setPage, queryString };
}

export type ListFilter =
  | { kind: "select"; name: string; label: string; empty?: string; allowEmpty?: boolean; options: Array<{ value: string; label: string }> }
  | { kind: "text"; name: string; label: string; placeholder?: string }
  | { kind: "check"; name: string; label: string }
  | { kind: "dates" };

function filterKeys(filters: ListFilter[]): string[] {
  const keys: string[] = [];
  for (const filter of filters) {
    if (filter.kind === "dates") keys.push("from", "to");
    else keys.push(filter.name);
  }
  return keys;
}

function activeCount(search: URLSearchParams, filters: ListFilter[]): number {
  let count = 0;
  for (const filter of filters) {
    if (filter.kind === "dates") {
      if (search.get("from") || search.get("to")) count += 1;
    } else if (search.get(filter.name)) {
      count += 1;
    }
  }
  return count;
}

function readDraft(search: URLSearchParams, filters: ListFilter[]): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const key of filterKeys(filters)) draft[key] = search.get(key) ?? "";
  return draft;
}

export function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label={label}>
      {children}
    </div>
  );
}

export function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`h-8 shrink-0 rounded-full px-3 text-sm font-medium ${active ? "bg-primary text-white" : "bg-white text-ink ring-1 ring-line"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function ListToolbar({
  placeholder,
  filters = [],
  desktop = "popover",
}: {
  placeholder: string;
  filters?: ListFilter[];
  desktop?: "popover" | "inline";
}) {
  const list = useListQuery();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const draftRef = useRef(draft);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const count = activeCount(list.search, filters);
  const sheetOnly = desktop === "inline" ? "lg:hidden" : "md:hidden";
  const popoverOnly = desktop === "popover" ? "hidden md:block" : "hidden";

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  function writeDraft(next: Record<string, string>) {
    draftRef.current = next;
    setDraft(next);
  }

  function openPanel() {
    writeDraft(readDraft(list.search, filters));
    setOpen(true);
  }

  function commit(next: Record<string, string>) {
    const patch: Record<string, string | null> = {};
    for (const key of filterKeys(filters)) patch[key] = next[key] || null;
    list.set(patch);
  }

  function apply() {
    commit(draftRef.current);
    setOpen(false);
  }

  function clear() {
    const empty: Record<string, string> = {};
    for (const key of filterKeys(filters)) empty[key] = "";
    writeDraft(empty);
    commit(empty);
    setOpen(false);
  }

  function updateDraft(name: string, value: string) {
    writeDraft({ ...draftRef.current, [name]: value });
  }

  return (
    <div ref={rootRef} className={desktop === "inline" ? "flex flex-wrap items-end gap-2" : "relative"}>
      <div className={`flex items-center gap-2 ${desktop === "inline" ? "min-w-[16rem] flex-1" : ""}`}>
        <SearchField placeholder={placeholder} />
        {filters.length > 0 ? (
          <button
            type="button"
            className={`btn-secondary h-10 shrink-0 gap-1.5 px-3 ${desktop === "inline" ? "lg:hidden" : ""}`}
            aria-expanded={open}
            onClick={() => (open ? setOpen(false) : openPanel())}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {count > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-white">{count}</span>
            ) : null}
          </button>
        ) : null}
      </div>
      {desktop === "inline" && filters.length > 0 ? (
        <div className="hidden items-end gap-2 lg:flex lg:flex-wrap">
          <FilterFields
            filters={filters}
            values={readDraft(list.search, filters)}
            live
            onChange={(name, value) => list.set({ [name]: value || null })}
          />
          {count > 0 ? (
            <button type="button" className="h-10 px-1 text-sm font-medium text-primary" onClick={clear}>Clear</button>
          ) : null}
        </div>
      ) : null}
      {open && filters.length > 0 ? (
        <>
          <div className={`fixed inset-0 z-50 ${sheetOnly}`} role="presentation">
            <button type="button" className="absolute inset-0 bg-navy/40" aria-label="Close filters" onClick={() => setOpen(false)} />
            <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-6 pt-3" role="dialog" aria-modal="true" aria-labelledby={`${titleId}-sheet`}>
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
              <div className="flex items-center justify-between">
                <h2 id={`${titleId}-sheet`} className="text-base font-semibold text-ink">Filters</h2>
                <button type="button" className="text-sm font-medium text-primary" onClick={clear}>Clear</button>
              </div>
              <div className="mt-4">
                <FilterFields filters={filters} values={draft} onChange={updateDraft} />
              </div>
              <button type="button" className="btn-primary mt-4 w-full" onClick={apply}>Apply</button>
            </div>
          </div>
          <div className={`absolute right-0 top-full z-30 mt-2 w-80 rounded-lg border border-line bg-white p-4 shadow-card ${popoverOnly}`} role="dialog" aria-labelledby={`${titleId}-pop`}>
            <div className="flex items-center justify-between">
              <h2 id={`${titleId}-pop`} className="text-sm font-semibold text-ink">Filters</h2>
              <button type="button" className="text-sm font-medium text-primary" onClick={clear}>Clear</button>
            </div>
            <div className="mt-3">
              <FilterFields filters={filters} values={draft} onChange={updateDraft} />
            </div>
            <button type="button" className="btn-primary mt-4 w-full" onClick={apply}>Apply</button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SearchField({ placeholder }: { placeholder: string }) {
  const { q, set } = useListQuery();
  const [text, setText] = useState(q);
  const setRef = useRef(set);
  setRef.current = set;

  useEffect(() => {
    setText(q);
  }, [q]);

  useEffect(() => {
    if (text === q) return;
    const timer = window.setTimeout(() => setRef.current({ q: text.trim() ? text.trim() : null }), 300);
    return () => window.clearTimeout(timer);
  }, [text, q]);

  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">Search</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        className="field pl-9"
        value={text}
        placeholder={placeholder}
        aria-label="Search"
        onChange={(event) => setText(event.target.value)}
      />
    </label>
  );
}

function FilterFields({
  filters,
  values,
  onChange,
  live = false,
}: {
  filters: ListFilter[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  live?: boolean;
}) {
  return (
    <div className={live ? "contents" : "space-y-3"}>
      {filters.map((filter) => {
        if (filter.kind === "dates") {
          return (
            <div key="dates" className={live ? "contents" : "grid grid-cols-2 gap-3"}>
              <DateField label="From" compact={live} value={values.from ?? ""} onCommit={(value) => onChange("from", value)} />
              <DateField label="To" compact={live} value={values.to ?? ""} onCommit={(value) => onChange("to", value)} />
            </div>
          );
        }
        if (filter.kind === "select") {
          return (
            <label key={filter.name} className={`block ${live ? "w-40" : ""}`}>
              <span className="label">{filter.label}</span>
              <select
                className="field"
                aria-label={filter.label}
                value={values[filter.name] || (filter.allowEmpty === false ? filter.options[0]?.value ?? "" : "")}
                onChange={(event) => onChange(filter.name, event.target.value)}
              >
                {filter.allowEmpty === false ? null : <option value="">{filter.empty ?? "Any"}</option>}
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          );
        }
        if (filter.kind === "check") {
          const checked = values[filter.name] === "1";
          return (
            <label key={filter.name} className={`flex items-center gap-2 text-sm text-ink ${live ? "h-10" : ""}`}>
              <input type="checkbox" checked={checked} onChange={(event) => onChange(filter.name, event.target.checked ? "1" : "")} />
              {filter.label}
            </label>
          );
        }
        return (
          <TextField
            key={filter.name}
            label={filter.label}
            placeholder={filter.placeholder}
            value={values[filter.name] ?? ""}
            live={live}
            wide={live}
            onCommit={(value) => onChange(filter.name, value)}
          />
        );
      })}
    </div>
  );
}

function TextField({
  label,
  placeholder,
  value,
  live,
  wide,
  onCommit,
}: {
  label: string;
  placeholder?: string;
  value: string;
  live: boolean;
  wide: boolean;
  onCommit: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (!live || text === value) return;
    const timer = window.setTimeout(() => commitRef.current(text.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [live, text, value]);

  return (
    <label className={`block min-w-0 ${wide ? "w-40" : ""}`}>
      <span className="label">{label}</span>
      <input
        className="field"
        placeholder={placeholder}
        aria-label={label}
        value={live ? text : value}
        onChange={(event) => (live ? setText(event.target.value) : onCommit(event.target.value))}
      />
    </label>
  );
}

function fromIso(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function toIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return iso;
}

function DateField({ label, value, compact, onCommit }: { label: string; value: string; compact?: boolean; onCommit: (iso: string) => void }) {
  const [text, setText] = useState(fromIso(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(fromIso(value));
    setInvalid(false);
  }, [value]);

  function commit(next: string) {
    const iso = toIso(next);
    if (iso === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (iso !== value) onCommit(iso);
  }

  return (
    <label className={`block min-w-0 ${compact ? "w-36" : "w-full"}`}>
      <span className="label">{label}</span>
      <input
        className="field tabular-nums"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        aria-label={label}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setInvalid(false);
        }}
        onBlur={() => commit(text)}
      />
      {invalid ? <span className="mt-1 block text-xs text-loss">Use dd/mm/yyyy</span> : null}
    </label>
  );
}

export function ListPager({ total, page, pageSize }: { total: number; page: number; pageSize: number }) {
  const { setPage, set } = useListQuery();
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safe = total === 0 ? 1 : Math.min(page, pages);
  const from = total === 0 ? 0 : (safe - 1) * pageSize + 1;
  const to = total === 0 ? 0 : Math.min(safe * pageSize, total);
  const buttons = pageButtons(safe, pages);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
      <p className="text-muted">{total === 0 ? "0 results" : `Showing ${from} to ${to} of ${total}`}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-muted">
          <span>Page size</span>
          <select
            className="field h-9 w-24 px-2"
            aria-label="Page size"
            value={String(pageSize)}
            onChange={(event) => set({ pageSize: event.target.value })}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button type="button" className="btn-quiet h-9 px-3" disabled={safe <= 1} onClick={() => setPage(safe - 1)}>
            Prev
          </button>
          {buttons.map((item) => (
            <button
              key={item}
              type="button"
              className={`h-9 min-w-9 rounded-lg px-2 text-sm font-medium ${item === safe ? "bg-primary text-white" : "text-ink hover:bg-canvas"}`}
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          ))}
          <button type="button" className="btn-quiet h-9 px-3" disabled={safe >= pages} onClick={() => setPage(safe + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
