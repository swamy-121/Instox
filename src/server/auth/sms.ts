import { AppError } from "@/lib/errors";
import { refreshIntegrations, runtimeEnv } from "@/server/integrations/store";

export type SmsSendResult = { providerMessageId: string | null };

export type SmsProvider = {
  id: "dev" | "apitxt";
  sendOtp(input: { to: string; otp: string }): Promise<SmsSendResult>;
};

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function devSmsProvider(log: (line: string) => void = (line) => console.info(line)): SmsProvider {
  return {
    id: "dev",
    async sendOtp({ to, otp }) {
      log(`[sms:dev] OTP for ${to} is ${otp}`);
      return { providerMessageId: null };
    },
  };
}

/**
 * APITxT OTP send. The call posts authkey, mobile, and otp only.
 * template_id, pe_id, and sender are omitted because this product sends without a DLT template.
 * Docs: POST https://apitxt.com/api/sendOTP
 */
export function apitxtSmsProvider(authkey: string, fetchImpl: FetchLike = fetch): SmsProvider {
  return {
    id: "apitxt",
    async sendOtp({ to, otp }) {
      const mobile = digitsOnly(to);
      if (!mobile) throw new AppError(400, "VALIDATION_ERROR", "Enter a valid phone number.");
      let response: Response;
      try {
        response = await fetchImpl("https://apitxt.com/api/sendOTP", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ authkey, mobile, otp }),
          signal: AbortSignal.timeout(8000),
        });
      } catch {
        throw new AppError(503, "PROVIDER_UNAVAILABLE", "The text message could not be sent.");
      }
      let payload: { status?: unknown } = {};
      try {
        payload = (await response.json()) as { status?: unknown };
      } catch {
        payload = {};
      }
      if (response.status === 401) throw new AppError(503, "PROVIDER_UNAVAILABLE", "APITxT rejected the API key.");
      if (response.status === 422) throw new AppError(400, "VALIDATION_ERROR", "That phone number was rejected.");
      if (response.status === 429) throw new AppError(429, "RATE_LIMITED", "Too many OTP texts. Wait and try again.");
      if (!response.ok || payload.status !== "success") {
        throw new AppError(503, "PROVIDER_UNAVAILABLE", "The text message could not be sent.");
      }
      const data = payload as { data?: { request_id?: unknown } };
      const requestId = data.data?.request_id;
      return { providerMessageId: typeof requestId === "string" ? requestId : null };
    },
  };
}

export async function resolveSmsProvider(fetchImpl?: FetchLike): Promise<SmsProvider> {
  await refreshIntegrations();
  const env = runtimeEnv();
  if (env.SMS_PROVIDER === "dev") return devSmsProvider();
  const key = env.APITXT_AUTHKEY ?? "";
  if (key) return apitxtSmsProvider(key, fetchImpl);
  return devSmsProvider();
}
