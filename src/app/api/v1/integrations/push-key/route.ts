import { requireActor } from "@/server/auth/actor";
import { refreshIntegrations, runtimeEnv } from "@/server/integrations/store";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/integrations/push-key", async ({ requestId }) => {
    await requireActor(request);
    await refreshIntegrations();
    return apiOk({ vapidKey: runtimeEnv().NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "" }, requestId);
  });
}
