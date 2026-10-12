import { AppError } from "@/lib/errors";
import { getPaymentProvider } from "@/server/payments/adapter";
import { apiOk, withApi } from "@/server/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
): Promise<Response> {
  return withApi(request, "POST /api/v1/webhooks/:provider", async ({ requestId }) => {
    const { provider: providerId } = await context.params;
    const provider = getPaymentProvider();
    if (providerId !== provider.id) {
      throw new AppError(404, "NOT_FOUND", "Unknown payment provider.");
    }
    const rawBody = await request.text();
    const verified = provider.verifyWebhookSignature(rawBody, request.headers.get("x-provider-signature"));
    if (!verified) {
      throw new AppError(403, "FORBIDDEN", "The payment event signature could not be verified.");
    }
    return apiOk({ accepted: true }, requestId);
  }, { skipOriginCheck: true });
}
