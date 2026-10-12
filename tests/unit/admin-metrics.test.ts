import { describe, expect, it } from "vitest";
import { buildDashboard } from "@/server/admin/metrics";

describe("admin dashboard metrics", () => {
  it("counts stored users, premium, revenue, and tips inside the window", () => {
    const model = buildDashboard({
      from: "2026-10-01",
      to: "2026-10-03",
      users: [
        { uid: "a", createdAt: "2026-10-01T00:00:00.000Z" },
        { uid: "b", createdAt: "2026-10-02T00:00:00.000Z" },
        { uid: "c", createdAt: "2026-09-20T00:00:00.000Z" },
      ],
      premiumUids: ["b"],
      tips: [
        { category: "equity", createdAt: "2026-10-02T00:00:00.000Z" },
        { category: "equity", createdAt: "2026-10-03T00:00:00.000Z" },
        { category: "options", createdAt: "2026-10-03T00:00:00.000Z" },
      ],
      orders: [
        { amountMinor: 10000, createdAt: "2026-10-01T00:00:00.000Z" },
        { amountMinor: 20000, createdAt: "2026-10-02T00:00:00.000Z" },
      ],
    });
    expect(model.totalUsers).toBe(3);
    expect(model.premiumUsers).toBe(1);
    expect(model.revenueMinor).toBe(30000);
    expect(model.totalTips).toBe(3);
    expect(model.growth.find((row) => row.date === "2026-10-02")).toMatchObject({ free: 0, premium: 1, revenue: 200 });
    expect(model.categories).toEqual([
      { category: "equity", count: 2 },
      { category: "options", count: 1 },
    ]);
  });
});
