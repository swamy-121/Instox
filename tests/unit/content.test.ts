import { describe, expect, it } from "vitest";
import { claimsPremiumGrant, MEMBER_COPY_DEFAULTS } from "@/lib/member-copy";
import { memberCopyFromValue, parseMemberCopy } from "@/server/content/member-config";
import { parseContent, publicRecord, tryParseContent } from "@/server/content/registry";
import { parseAdminOrderStatus } from "@/server/payments/order-admin";

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

  it("hides draft home tiles and keeps templates off the public feed", () => {
    const draft = parseContent("homeTiles", {
      id: "tile_hidden",
      href: "/tips",
      label: "Tips",
      icon: "tips",
      status: "draft",
      sort: 1,
    });
    expect(publicRecord("homeTiles", draft)).toBeNull();
    const template = parseContent("notificationTemplates", {
      id: "tpl_1",
      name: "Open",
      title: "Open",
      body: "Hello",
      kind: "reminder",
      status: "published",
      sort: 1,
    });
    expect(publicRecord("notificationTemplates", template)).toBeNull();
  });

  it("fills missing member copy and rejects a premium grant claim", () => {
    expect(memberCopyFromValue({ greetingPrefix: "Hello" }).greetingPrefix).toBe("Hello");
    expect(memberCopyFromValue({ greetingPrefix: "Hello" }).paymentSuccessTitle).toBe(MEMBER_COPY_DEFAULTS.paymentSuccessTitle);
    expect(memberCopyFromValue({ greetingSubtitle: "Let us find your next opportunity" }).greetingSubtitle).toBe(MEMBER_COPY_DEFAULTS.greetingSubtitle);
    expect(memberCopyFromValue({ greetingSubtitle: "Desk notes for the session." }).greetingSubtitle).toBe("Desk notes for the session.");
    expect(claimsPremiumGrant("Payment successful", "Your order is saved.")).toBe(false);
    expect(() =>
      parseMemberCopy({
        ...MEMBER_COPY_DEFAULTS,
        paymentSuccessTitle: "Premium unlocked",
        paymentSuccessBody: "You now have premium.",
      }),
    ).toThrow(/premium was granted/);
  });

  it("refuses to mark an order paid from the admin status control", () => {
    expect(parseAdminOrderStatus("refunded")).toBe("refunded");
    expect(() => parseAdminOrderStatus("paid_verified")).toThrow(/Paid is not an admin status/);
  });
});
