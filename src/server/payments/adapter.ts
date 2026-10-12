import { AppError } from "@/lib/errors";
import { refreshIntegrations, runtimeEnv } from "@/server/integrations/store";
import { verifyCashfreeSignature, verifyRazorpaySignature } from "@/server/payments/signature";

export type CheckoutSession = {
  provider: string;
  session: string | null;
  mode: "stub" | "test";
  configured: boolean;
  remote: boolean;
  message: string;
};

export type NormalizedWebhook = {
  providerEventId: string;
  eventType: "payment.captured" | "payment.failed" | "payment.refunded" | "payment.disputed";
  orderId: string | null;
  amountMinor: number;
  currency: string;
};

export type PaymentProvider = {
  readonly id: string;
  createCheckoutSession(input: {
    orderId: string;
    amountMinor: number;
    currency: string;
    planId: string;
  }): Promise<CheckoutSession>;
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean;
  parseWebhook(rawBody: string): NormalizedWebhook | null;
};

export class StubPaymentProvider implements PaymentProvider {
  readonly id = "stub";

  async createCheckoutSession(input: {
    orderId: string;
    amountMinor: number;
    currency: string;
    planId: string;
  }): Promise<CheckoutSession> {
    return {
      provider: this.id,
      session: `stub_session_${input.orderId}`,
      mode: "stub",
      configured: true,
      remote: false,
      message: "Checkout is a local stub. This does not activate premium.",
    };
  }

  verifyWebhookSignature(): boolean {
    return false;
  }

  parseWebhook(): null {
    return null;
  }
}

function assertTestMode(providerName: string): void {
  const mode = process.env.PAYMENTS_MODE || "test";
  if (mode !== "test") {
    throw new AppError(503, "PROVIDER_UNAVAILABLE", `${providerName} live mode is disabled. Set PAYMENTS_MODE=test.`);
  }
}

function localTestSession(provider: string, orderId: string, configured: boolean): CheckoutSession {
  return {
    provider,
    session: configured ? `test_local_${orderId}` : null,
    mode: "test",
    configured,
    remote: false,
    message: configured
      ? `${provider} keys are present, but remote calls stay off. This local test session does not collect payment or activate premium.`
      : `${provider} test keys are not set. No order was sent to the provider.`,
  };
}

export class RazorpayPaymentProvider implements PaymentProvider {
  readonly id = "razorpay";

  constructor(
    private readonly keyId = process.env.RAZORPAY_KEY_ID ?? "",
    private readonly keySecret = process.env.RAZORPAY_KEY_SECRET ?? "",
    private readonly webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  ) {}

  async createCheckoutSession(input: {
    orderId: string;
    amountMinor: number;
    currency: string;
    planId: string;
  }): Promise<CheckoutSession> {
    assertTestMode("Razorpay");
    if (!this.keyId || !this.keySecret) {
      throw new AppError(503, "PROVIDER_UNAVAILABLE", "Razorpay test keys are not set. No order was created at Razorpay.");
    }
    void input.planId;
    void input.amountMinor;
    void input.currency;
    if (process.env.PAYMENTS_REMOTE === "true") {
      throw new AppError(503, "PROVIDER_UNAVAILABLE", "Remote Razorpay calls are not enabled in this build.");
    }
    return localTestSession(this.id, input.orderId, true);
  }

  verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
    return verifyRazorpaySignature(this.webhookSecret, rawBody, headers.get("x-razorpay-signature"));
  }

  parseWebhook(rawBody: string): NormalizedWebhook | null {
    return parseRazorpayBody(rawBody);
  }
}

export class CashfreePaymentProvider implements PaymentProvider {
  readonly id = "cashfree";

  constructor(
    private readonly clientId = process.env.CASHFREE_CLIENT_ID ?? "",
    private readonly clientSecret = process.env.CASHFREE_CLIENT_SECRET ?? "",
    private readonly webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || process.env.CASHFREE_CLIENT_SECRET || "",
  ) {}

  async createCheckoutSession(input: {
    orderId: string;
    amountMinor: number;
    currency: string;
    planId: string;
  }): Promise<CheckoutSession> {
    assertTestMode("Cashfree");
    if (!this.clientId || !this.clientSecret) {
      throw new AppError(503, "PROVIDER_UNAVAILABLE", "Cashfree test keys are not set. No order was created at Cashfree.");
    }
    void input.planId;
    void input.amountMinor;
    void input.currency;
    if (process.env.PAYMENTS_REMOTE === "true") {
      throw new AppError(503, "PROVIDER_UNAVAILABLE", "Remote Cashfree calls are not enabled in this build.");
    }
    return localTestSession(this.id, input.orderId, true);
  }

  verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
    return verifyCashfreeSignature(
      this.webhookSecret,
      headers.get("x-webhook-timestamp"),
      rawBody,
      headers.get("x-webhook-signature"),
    );
  }

  parseWebhook(rawBody: string): NormalizedWebhook | null {
    return parseCashfreeBody(rawBody);
  }
}

function eventTypeFrom(value: string): NormalizedWebhook["eventType"] | null {
  const name = value.toLowerCase();
  if (name.includes("captured") || name.includes("success") || name === "payment_success_webhook") return "payment.captured";
  if (name.includes("failed") || name.includes("fail")) return "payment.failed";
  if (name.includes("refund")) return "payment.refunded";
  if (name.includes("dispute") || name.includes("chargeback")) return "payment.disputed";
  return null;
}

export function parseRazorpayBody(rawBody: string): NormalizedWebhook | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const eventType = eventTypeFrom(String(record.event ?? ""));
  const providerEventId = String(record.id ?? "");
  const payload = record.payload as Record<string, unknown> | undefined;
  const payment = (payload?.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
  if (!eventType || !providerEventId || !payment) return null;
  const notes = payment.notes as Record<string, unknown> | undefined;
  const amount = Number(payment.amount);
  if (!Number.isFinite(amount)) return null;
  return {
    providerEventId,
    eventType,
    orderId: notes?.orderId ? String(notes.orderId) : null,
    amountMinor: amount,
    currency: String(payment.currency ?? ""),
  };
}

export function parseCashfreeBody(rawBody: string): NormalizedWebhook | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const eventType = eventTypeFrom(String(record.type ?? ""));
  const data = record.data as Record<string, unknown> | undefined;
  const order = data?.order as Record<string, unknown> | undefined;
  const payment = data?.payment as Record<string, unknown> | undefined;
  const providerEventId = String(payment?.cf_payment_id ?? record.event_id ?? "");
  if (!eventType || !providerEventId || !order) return null;
  const major = Number(order.order_amount);
  if (!Number.isFinite(major)) return null;
  return {
    providerEventId,
    eventType,
    orderId: order.order_id ? String(order.order_id) : null,
    amountMinor: Math.round(major * 100),
    currency: String(order.order_currency ?? ""),
  };
}

export function paymentProviderById(id: string): PaymentProvider | null {
  const env = runtimeEnv();
  if (id === "stub") return new StubPaymentProvider();
  if (id === "razorpay") {
    return new RazorpayPaymentProvider(env.RAZORPAY_KEY_ID ?? "", env.RAZORPAY_KEY_SECRET ?? "", env.RAZORPAY_WEBHOOK_SECRET ?? "");
  }
  if (id === "cashfree") {
    return new CashfreePaymentProvider(
      env.CASHFREE_CLIENT_ID ?? "",
      env.CASHFREE_CLIENT_SECRET ?? "",
      env.CASHFREE_WEBHOOK_SECRET || env.CASHFREE_CLIENT_SECRET || "",
    );
  }
  return null;
}

export async function getPaymentProvider(): Promise<PaymentProvider> {
  await refreshIntegrations();
  const id = runtimeEnv().PAYMENTS_PROVIDER || "stub";
  return paymentProviderById(id) ?? new StubPaymentProvider();
}
