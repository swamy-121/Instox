export type CheckoutSession = {
  provider: string;
  session: string;
  mode: "stub";
};

export type PaymentProvider = {
  readonly id: string;
  createCheckoutSession(input: {
    orderId: string;
    amountMinor: number;
    currency: string;
    planId: string;
  }): Promise<CheckoutSession>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;
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
    };
  }

  verifyWebhookSignature(): boolean {
    return false;
  }
}

export function getPaymentProvider(): PaymentProvider {
  return new StubPaymentProvider();
}
