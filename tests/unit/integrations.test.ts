import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, integrationKey, maskSecret } from "@/server/integrations/crypto";
import { fieldsForTab, INTEGRATION_FIELDS, INTEGRATION_TABS, tabSelection } from "@/server/integrations/fields";
import { fieldViews, resolveFields, resetIntegrationCache } from "@/server/integrations/store";
import { probeIntegration } from "@/server/integrations/probe";

describe("integration secrets", () => {
  it("encrypts a secret so the stored blob is not the plaintext", () => {
    const key = integrationKey("integration-test-key-01");
    const blob = encryptSecret("rzp_test_secret_value_1234", key);
    expect(JSON.stringify(blob)).not.toContain("rzp_test_secret_value_1234");
    expect(decryptSecret(blob, key)).toBe("rzp_test_secret_value_1234");
    expect(() => decryptSecret(blob, integrationKey("another-long-test-key"))).toThrow();
  });

  it("masks every value except the last four characters", () => {
    expect(maskSecret("rzp_test_secret_value_1234")).toBe("••••1234");
    expect(maskSecret("abcd")).toBe("••••");
    expect(maskSecret("")).toBe("");
  });

  it("prefers a saved value and hides the secret from the admin view", () => {
    const fields = resolveFields({ RAZORPAY_KEY_SECRET: "rzp_test_secret_value_1234" }, { RAZORPAY_KEY_SECRET: "env-secret-9999" });
    expect(fields.RAZORPAY_KEY_SECRET?.source).toBe("stored");
    const view = fieldViews(fields).find((field) => field.key === "RAZORPAY_KEY_SECRET");
    expect(view?.masked).toBe("••••1234");
    expect(view?.value).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain("rzp_test_secret_value_1234");
    expect(resolveFields({}, { ALICEBLUE_APP_CODE: "APP1" }).ALICEBLUE_APP_CODE?.source).toBe("env");
    expect(resolveFields({ ALICEBLUE_APP_CODE: null }, { ALICEBLUE_APP_CODE: "APP1" }).ALICEBLUE_APP_CODE?.source).toBe("unreadable");
  });

  it("reports a rejected Razorpay test without calling a real network", async () => {
    resetIntegrationCache();
    const previous = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    process.env.RAZORPAY_KEY_ID = "rzp_test_id";
    process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";
    const result = await probeIntegration("razorpay", async () => new Response("", { status: 401 }));
    if (previous === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = previous;
    if (secret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = secret;
    resetIntegrationCache();
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Razorpay rejected those keys.");
    expect(result.message).not.toContain("rzp_test_secret");
  });

  it("builds the integrations form from the config schema", () => {
    expect(INTEGRATION_TABS.map((tab) => tab.title)).toEqual(["Payments", "SMS", "Market data", "Push"]);
    const payments = INTEGRATION_TABS[0];
    if (!payments) throw new Error("Payments tab is missing.");
    expect(payments.selector?.options.map((option) => option.label)).toEqual(["Razorpay", "Cashfree"]);
    expect(tabSelection(payments, "cashfree")).toBe("cashfree");
    expect(tabSelection(payments, "stub")).toBe("razorpay");
    const razorpay = fieldsForTab(payments, "razorpay").map((field) => field.key);
    const cashfree = fieldsForTab(payments, "cashfree").map((field) => field.key);
    expect(razorpay).toEqual(["PAYMENTS_PROVIDER", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"]);
    expect(cashfree).toContain("CASHFREE_CLIENT_ID");
    expect(cashfree).not.toContain("RAZORPAY_KEY_ID");
    expect(INTEGRATION_FIELDS.map((field) => field.key)).toContain("APITXT_AUTHKEY");
    const page = readFileSync("src/app/admin/integrations/page.tsx", "utf8");
    expect(page).toContain("INTEGRATION_TABS");
    expect(page).toContain("fieldsForTab");
    expect(page).not.toContain("RAZORPAY_KEY_ID");
  });
});
