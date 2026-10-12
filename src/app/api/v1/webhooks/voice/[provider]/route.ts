import { AppError } from "@/lib/errors";
import { apiOk, withApi } from "@/server/http";
import { refreshIntegrations, runtimeEnv } from "@/server/integrations/store";
import { applyVoiceWebhook, parseBolnaWebhook, parseVapiWebhook, webhookSecretMatches } from "@/server/voice/service";

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }): Promise<Response> {
  return withApi(request, "POST /api/v1/webhooks/voice/:provider", async ({ requestId }) => {
    const { provider } = await context.params;
    if (provider !== "bolna" && provider !== "vapi") throw new AppError(404, "NOT_FOUND", "Unknown voice provider.");
    await refreshIntegrations();
    const expected = (runtimeEnv().VOICE_WEBHOOK_SECRET ?? "").trim();
    if (expected.length < 8) throw new AppError(503, "PROVIDER_UNAVAILABLE", "Set the voice webhook secret before accepting call results.");
    const url = new URL(request.url);
    const presented = request.headers.get("x-instox-voice-secret") ?? url.searchParams.get("token") ?? "";
    if (!webhookSecretMatches(presented, expected)) {
      throw new AppError(403, "FORBIDDEN", "The voice webhook secret did not match.");
    }
    const body = await request.json().catch(() => null);
    const update = provider === "bolna" ? parseBolnaWebhook(body) : parseVapiWebhook(body);
    if (!update) throw new AppError(422, "BUSINESS_RULE_FAILED", "The call result could not be read.");
    const matched = await applyVoiceWebhook(update);
    if (!matched) throw new AppError(404, "NOT_FOUND", "That call is not in the CRM.");
    return apiOk({ updated: true }, requestId);
  });
}
