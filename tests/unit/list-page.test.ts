import { describe, expect, it } from "vitest";
import { applyPage, inDateRange, readPage, slicePage } from "@/lib/list-page";

describe("list pages", () => {
  it("keeps the full list when the caller did not ask for a page", () => {
    const rows = ["a", "b", "c"];
    const window = applyPage(rows, new URLSearchParams());
    expect(window.items).toEqual(rows);
    expect(window.total).toBe(3);
  });

  it("returns one server page and the total", () => {
    const rows = Array.from({ length: 25 }, (_, index) => index + 1);
    const window = slicePage(rows, 2, 10);
    expect(window.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(window.total).toBe(25);
    expect(readPage(new URLSearchParams("page=2&pageSize=10"))).toMatchObject({ page: 2, pageSize: 10, paged: true });
  });

  it("rejects an unknown page size and clamps the page", () => {
    expect(readPage(new URLSearchParams("pageSize=7")).pageSize).toBe(20);
    expect(slicePage([1], 4, 10).page).toBe(1);
    expect(inDateRange("2026-10-02T00:00:00.000Z", "2026-10-01", "2026-10-03")).toBe(true);
    expect(inDateRange("2026-09-30T00:00:00.000Z", "2026-10-01", null)).toBe(false);
  });
});
