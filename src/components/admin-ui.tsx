"use client";

import { useMemo, useState } from "react";

export function AdminTitle({
  title,
  lede,
  action,
}: {
  title: string;
  lede?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {lede ? <p className="mt-1 text-sm text-muted">{lede}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function AdminTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${active ? "bg-primary text-white" : "bg-white text-ink ring-1 ring-line hover:bg-canvas"}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {tab.count != null ? ` (${tab.count})` : ""}
          </button>
        );
      })}
    </div>
  );
}

const PILL = {
  green: "bg-[#E5F6EC] text-[#027332]",
  red: "bg-[#FDECEC] text-[#B42318]",
  gray: "bg-[#F3F6F4] text-[#4F6B5E]",
  teal: "bg-[#E6F6F8] text-[#018193]",
} as const;

export function Pill({ children, tone = "gray" }: { children: React.ReactNode; tone?: keyof typeof PILL }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[tone]}`}>{children}</span>;
}

export function usePage<T>(rows: T[], size = 8) {
  const [page, setPage] = useState(1);
  return useMemo(() => {
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const safe = Math.min(page, pages);
    const start = (safe - 1) * size;
    const slice = rows.slice(start, start + size);
    return {
      page: safe,
      pages,
      slice,
      setPage,
      from: rows.length === 0 ? 0 : start + 1,
      to: start + slice.length,
      total: rows.length,
    };
  }, [page, rows, size]);
}

export function Pager({
  page,
  pages,
  from,
  to,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  const buttons = Array.from({ length: pages }, (_, index) => index + 1).slice(0, 6);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <p>
        Showing {from} to {to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className="btn-quiet h-9 px-3" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </button>
        {buttons.map((item) => (
          <button
            key={item}
            type="button"
            className={`h-9 min-w-9 rounded-xl px-2 text-sm font-medium ${item === page ? "bg-primary text-white" : "text-ink hover:bg-canvas"}`}
            onClick={() => onPage(item)}
          >
            {item}
          </button>
        ))}
        <button type="button" className="btn-quiet h-9 px-3" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export function changeLabel(value: number | null): { text: string; up: boolean | null } {
  if (value === null) return { text: "n/a", up: null };
  const up = value >= 0;
  return { text: `${up ? "+" : ""}${value}%`, up };
}
