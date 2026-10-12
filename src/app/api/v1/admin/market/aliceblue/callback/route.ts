import { requireOperations } from "@/server/auth/operations";
import { exchangeAliceAuthCode } from "@/server/market-data/aliceblue";
import { saveAliceSession } from "@/server/market-data/alice-store";
import { withApi } from "@/server/http";

function readCookie(request: Request, name: string): string {
  const header = request.headers.get("cookie") ?? "";
  const found = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!found) return "";
  try {
    return decodeURIComponent(found.slice(name.length + 1));
  } catch {
    return "";
  }
}

function clearStateCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `instox_alice_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/market/aliceblue/callback", async () => {
    await requireOperations(request);
    const url = new URL(request.url);
    const failed = new URL("/admin?alice=failed", request.url);
    const authCode = url.searchParams.get("authCode") ?? "";
    const userId = url.searchParams.get("userId") ?? "";
    const state = url.searchParams.get("state");
    const expected = readCookie(request, "instox_alice_state");
    const apiSecret = process.env.ALICEBLUE_API_SECRET ?? "";
    if (!authCode || !userId || !apiSecret || (state && state !== expected)) {
      return new Response(null, { status: 302, headers: { location: failed.toString(), "set-cookie": clearStateCookie() } });
    }
    try {
      const session = await exchangeAliceAuthCode({ userId, authCode, apiSecret });
      await saveAliceSession(session);
      return new Response(null, {
        status: 302,
        headers: {
          location: new URL("/admin?alice=connected", request.url).toString(),
          "set-cookie": clearStateCookie(),
          "cache-control": "no-store",
        },
      });
    } catch {
      return new Response(null, { status: 302, headers: { location: failed.toString(), "set-cookie": clearStateCookie() } });
    }
  });
}
