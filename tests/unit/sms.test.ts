import { afterEach, describe, expect, it } from "vitest";
import { apitxtSmsProvider, devSmsProvider, resolveSmsProvider } from "@/server/auth/sms";
import { resetIntegrationCache } from "@/server/integrations/store";

const KEY = "test-key-12345678";

afterEach(() => {
  resetIntegrationCache();
  delete process.env.APITXT_AUTHKEY;
  delete process.env.SMS_PROVIDER;
});

describe("apitxt sms", () => {
  it("posts the key, mobile, and code without DLT fields", async () => {
    const seen: { url: string; body: string; type: string } = { url: "", body: "", type: "" };
    const provider = apitxtSmsProvider(KEY, async (url, init) => {
      seen.url = url;
      seen.body = String(init?.body ?? "");
      seen.type = String((init?.headers as Record<string, string>)["content-type"] ?? "");
      return new Response(JSON.stringify({ status: "success", data: { request_id: "req_1" } }), { status: 200 });
    });
    const result = await provider.sendOtp({ to: "+919876543210", otp: "123456" });
    expect(result.providerMessageId).toBe("req_1");
    expect(seen.url).toBe("https://apitxt.com/api/sendOTP");
    expect(seen.type).toBe("application/x-www-form-urlencoded");
    const params = new URLSearchParams(seen.body);
    expect(params.get("authkey")).toBe(KEY);
    expect(params.get("mobile")).toBe("919876543210");
    expect(params.get("otp")).toBe("123456");
    expect(params.has("template_id")).toBe(false);
    expect(params.has("pe_id")).toBe(false);
    expect(params.has("sender")).toBe(false);
  });

  it("rejects a bad key without echoing the secret or the code", async () => {
    const provider = apitxtSmsProvider(KEY, async () => new Response("{}", { status: 401 }));
    await expect(provider.sendOtp({ to: "+919876543210", otp: "654321" })).rejects.toMatchObject({
      status: 503,
    });
  });

  it("uses the dev logger when no key is saved and when SMS_PROVIDER is dev", async () => {
    const lines: string[] = [];
    const dev = devSmsProvider((line) => lines.push(line));
    await dev.sendOtp({ to: "+919000000001", otp: "111111" });
    expect(lines[0]).toContain("[sms:dev]");
    expect(lines[0]).toContain("+919000000001");

    resetIntegrationCache();
    const fallback = await resolveSmsProvider();
    expect(fallback.id).toBe("dev");

    process.env.APITXT_AUTHKEY = KEY;
    resetIntegrationCache();
    const live = await resolveSmsProvider(async () => new Response(JSON.stringify({ status: "success" }), { status: 200 }));
    expect(live.id).toBe("apitxt");

    process.env.SMS_PROVIDER = "dev";
    resetIntegrationCache();
    const forced = await resolveSmsProvider();
    expect(forced.id).toBe("dev");
  });
});
