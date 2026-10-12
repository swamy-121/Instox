import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("sign-in", () => {
  it("has no one-tap demo login and no development token route", () => {
    const page = readFileSync("src/app/sign-in/page.tsx", "utf8");
    const readme = readFileSync("README.md", "utf8");
    const example = readFileSync(".env.example", "utf8");
    for (const source of [page, readme, example]) {
      expect(source).not.toContain("demo-login");
      expect(source).not.toContain("NEXT_PUBLIC_DEMO_LOGIN");
      expect(source).not.toContain("custom-token");
    }
    expect(page).not.toContain("Free member");
    expect(page).not.toContain("Super admin");
    expect(existsSync("src/app/api/v1/dev/demo-login/route.ts")).toBe(false);
    expect(existsSync("src/app/api/v1/dev/custom-token/route.ts")).toBe(false);
  });
});
