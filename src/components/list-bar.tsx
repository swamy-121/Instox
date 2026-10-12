"use client";

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

export function ListBar({
  placeholder,
  showDates = false,
  extra,
  fields = [],
}: {
  placeholder: string;
  showDates?: boolean;
  extra?: React.ReactNode;
  fields?: string[];
}) {
  const { search, set, q, pageSize } = useListQuery();
  const from = search.get("from") ?? "";
  const to = search.get("to") ?? "";
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const patch: Record<string, string | null> = {
          q: String(data.get("q") ?? ""),
          from: showDates ? String(data.get("from") ?? "") : null,
          to: showDates ? String(data.get("to") ?? "") : null,
          pageSize: String(data.get("pageSize") ?? pageSize),
        };
        for (const key of fields) patch[key] = String(data.get(key) ?? "");
        set(patch);
      }}
    >
      {extra}
      <label className="min-w-[12rem] flex-1">
        <span className="label">Search</span>
        <input className="field" name="q" key={q} defaultValue={q} placeholder={placeholder} aria-label="Search" />
      </label>
      {showDates ? (
        <>
          <label>
            <span className="label">From</span>
            <input className="field w-40" type="date" name="from" key={from} defaultValue={from} />
          </label>
          <label>
            <span className="label">To</span>
            <input className="field w-40" type="date" name="to" key={to} defaultValue={to} />
          </label>
        </>
      ) : null}
      <label>
        <span className="label">Page size</span>
        <select
          className="field w-24"
          name="pageSize"
          value={String(pageSize)}
          aria-label="Page size"
          onChange={(event) => set({ pageSize: event.target.value })}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </label>
      <button className="btn-secondary" type="submit">Apply</button>
    </form>
  );
}

export function ListPager({ total, page, pageSize }: { total: number; page: number; pageSize: number }) {
  const { setPage } = useListQuery();
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safe = total === 0 ? 1 : Math.min(page, pages);
  const from = total === 0 ? 0 : (safe - 1) * pageSize + 1;
  const to = total === 0 ? 0 : Math.min(safe * pageSize, total);
  const buttons = pageButtons(safe, pages);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <p>{total === 0 ? "0 results" : `Showing ${from} to ${to} of ${total}`}</p>
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
  );
}
