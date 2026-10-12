import { createHash } from "node:crypto";
import { INTEGRATION_GROUPS, type IntegrationGroup } from "@/server/integrations/fields";
import { refreshIntegrations, type ResolvedField } from "@/server/integrations/store";

export type ProbeResult = { ok: boolean; message: string };

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

function value(fields: Record<string, ResolvedField>, key: string): string {
  return fields[key]?.value ?? "";
}

export async function probeIntegration(group: IntegrationGroup, fetchImpl: FetchLike = fetch): Promise<ProbeResult> {
  const fields = await refreshIntegrations();
  if (group === "razorpay") return probeRazorpay(value(fields, "RAZORPAY_KEY_ID"), value(fields, "RAZORPAY_KEY_SECRET"), fetchImpl);
  if (group === "cashfree") return probeCashfree(value(fields, "CASHFREE_CLIENT_ID"), value(fields, "CASHFREE_CLIENT_SECRET"), fetchImpl);
  if (group === "aliceblue") return probeAlice(value(fields, "ALICEBLUE_APP_CODE"), value(fields, "ALICEBLUE_API_SECRET"), fetchImpl);
  if (group === "fcm") return probeFcm(value(fields, "NEXT_PUBLIC_FIREBASE_VAPID_KEY"));
  if (group === "sms") return probeSms(value(fields, "APITXT_AUTHKEY"));
  if (group === "voice") return probeVoice(value(fields, "VOICE_PROVIDER"), value(fields, "BOLNA_API_KEY"), value(fields, "VAPI_API_KEY"));
  return { ok: true, message: "The payment provider is saved. Remote checkout stays off." };
}

export function isIntegrationGroup(value: string): value is IntegrationGroup {
  return (INTEGRATION_GROUPS as readonly string[]).includes(value);
}

async function probeRazorpay(keyId: string, keySecret: string, fetchImpl: FetchLike): Promise<ProbeResult> {
  if (!keyId || !keySecret) return { ok: false, message: "Razorpay key id and key secret are not set." };
  try {
    const response = await fetchImpl("https://api.razorpay.com/v1/orders?count=1", {
      headers: { authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` },
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401) return { ok: false, message: "Razorpay rejected those keys." };
    if (response.ok) return { ok: true, message: "Razorpay accepted the keys. Remote checkout stays off." };
    return { ok: false, message: "Razorpay did not accept the connection." };
  } catch {
    return { ok: false, message: "Razorpay did not respond." };
  }
}

async function probeCashfree(clientId: string, clientSecret: string, fetchImpl: FetchLike): Promise<ProbeResult> {
  if (!clientId || !clientSecret) return { ok: false, message: "Cashfree client id and client secret are not set." };
  try {
    const response = await fetchImpl("https://sandbox.cashfree.com/pg/orders/instox_connection_probe", {
      headers: {
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
        "x-api-version": "2023-08-01",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401 || response.status === 403) return { ok: false, message: "Cashfree rejected those keys." };
    if (response.ok || response.status === 404) return { ok: true, message: "Cashfree sandbox accepted the keys. Remote checkout stays off." };
    return { ok: false, message: "Cashfree did not accept the connection." };
  } catch {
    return { ok: false, message: "Cashfree did not respond." };
  }
}

async function probeAlice(appCode: string, apiSecret: string, fetchImpl: FetchLike): Promise<ProbeResult> {
  if (!appCode || !apiSecret) return { ok: false, message: "Alice Blue app code and API secret are not set." };
  const checkSum = createHash("sha256").update(`${appCode}probe${apiSecret}`).digest("hex");
  try {
    const response = await fetchImpl("https://a3.aliceblueonline.com/open-api/od/v1/vendor/getUserDetails", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkSum }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok && response.status !== 400) return { ok: false, message: "Alice Blue did not accept the connection." };
    return { ok: true, message: "Alice Blue answered. Connect Alice Blue each market day to stream the three indices." };
  } catch {
    return { ok: false, message: "Alice Blue did not respond." };
  }
}

function probeSms(authkey: string): ProbeResult {
  if (!authkey) {
    return { ok: true, message: "APITxT is not set, so sign-in codes are written to the server log." };
  }
  if (authkey.length < 8) return { ok: false, message: "That APITxT key looks too short." };
  return { ok: true, message: "The APITxT key is saved. Phone codes are sent without a DLT template." };
}

function probeVoice(provider: string, bolnaKey: string, vapiKey: string): ProbeResult {
  if (provider === "dev" || (!provider && !bolnaKey && !vapiKey)) {
    return { ok: true, message: "No voice key is set, so campaigns are simulated and written to the CRM." };
  }
  if (provider === "vapi" || (!provider && vapiKey && !bolnaKey)) {
    if (vapiKey.length < 8) return { ok: false, message: "That Vapi key looks too short." };
    return { ok: true, message: "The Vapi key is saved. Calls use a natural voice and can be interrupted." };
  }
  if (bolnaKey.length < 8) return { ok: false, message: "That Bolna key looks too short." };
  return { ok: true, message: "The Bolna key is saved. Calls use a natural voice and can be interrupted." };
}

function probeFcm(vapidKey: string): ProbeResult {
  if (!vapidKey) return { ok: false, message: "The web push key is not set." };
  if (!/^[A-Za-z0-9_-]{80,200}$/.test(vapidKey)) {
    return { ok: false, message: "That web push key does not look like a Firebase certificate." };
  }
  const adminReady = Boolean(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
  if (!adminReady) {
    return { ok: true, message: "The web push key is saved. Firebase Admin credentials are still required in the server environment before a message can be sent." };
  }
  return { ok: true, message: "The web push key is saved. Sends still use the Firebase Admin credentials from the server environment." };
}
