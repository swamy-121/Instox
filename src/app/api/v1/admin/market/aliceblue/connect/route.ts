import { randomBytes } from "node:crypto";
import { requireOperations } from "@/server/auth/operations";
import { refreshIntegrations, runtimeEnv } from "@/server/integrations/store";
import { ALICE_LOGIN_URL } from "@/server/market-data/aliceblue";
import { aliceConfigured } from "@/server/market-data/alice-store";
import { withApi } from "@/server/http";

function stateCookie(value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `instox_alice_state=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/market/aliceblue/connect", async () => {
    await requireOperations(request);
    await refreshIntegrations();
    if (!aliceConfigured()) {
      return Response.redirect(new URL("/admin?alice=unconfigured", request.url), 302);
    }
    const state = randomBytes(16).toString("hex");
    const appCode = runtimeEnv().ALICEBLUE_APP_CODE ?? "";
    const login = new URL(ALICE_LOGIN_URL);
    login.searchParams.set("appcode", appCode);
    login.searchParams.set("state", state);
    return new Response(null, {
      status: 302,
      headers: {
        location: login.toString(),
        "set-cookie": stateCookie(state, 15 * 60),
        "cache-control": "no-store",
      },
    });
  });
}
