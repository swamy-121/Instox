import { describe, expect, it } from "vitest";
import { parseContent, publicRecord, tryParseContent } from "@/server/content/registry";

describe("content registry", () => {
  it("accepts a stored index and hides drafts", () => {
    const row = parseContent("indices", {
      id: "NIFTY",
      symbol: "NIFTY",
      name: "Nifty 50",
      last: 24635.5,
      changePct: 0.82,
      kind: "index",
      sort: 1,
    });
    expect(publicRecord("indices", row)?.symbol).toBe("NIFTY");

    const draft = parseContent("newsArticles", {
      id: "news_hidden",
      title: "Draft",
      summary: "Not public.",
      source: "Desk",
      category: "Markets",
      publishedAt: "2026-10-11T00:00:00.000Z",
      status: "draft",
      sort: 1,
    });
    expect(publicRecord("newsArticles", draft)).toBeNull();
  });

  it("skips a stored row that is missing required fields", () => {
    expect(tryParseContent("newsArticles", { id: "news_1", title: "Sample", status: "published" })).toBeNull();
  });
});
