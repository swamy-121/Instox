export const PAGE_SIZES = [10, 20, 50] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export function readPage(params: URLSearchParams): { page: number; pageSize: number; paged: boolean } {
  const paged = params.has("page") || params.has("pageSize");
  const rawSize = Number(params.get("pageSize") ?? "20");
  const pageSize = PAGE_SIZES.includes(rawSize as PageSize) ? rawSize : 20;
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1;
  return { page, pageSize, paged };
}

export function slicePage<T>(rows: T[], page: number, pageSize: number): {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
} {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safe = total === 0 ? 1 : Math.min(page, pages);
  const start = (safe - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), total, page: safe, pageSize };
}

export function applyPage<T>(rows: T[], params: URLSearchParams): {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
} {
  const { page, pageSize, paged } = readPage(params);
  if (!paged) return { items: rows, total: rows.length, page: 1, pageSize: rows.length || pageSize };
  return slicePage(rows, page, pageSize);
}

export function inDateRange(iso: string | null | undefined, from: string | null, to: string | null): boolean {
  if (!from && !to) return true;
  if (!iso) return false;
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function pageButtons(page: number, pages: number): number[] {
  const width = 5;
  let start = Math.max(1, page - 2);
  const end = Math.min(pages, start + width - 1);
  start = Math.max(1, end - width + 1);
  const buttons: number[] = [];
  for (let item = start; item <= end; item += 1) buttons.push(item);
  return buttons;
}
