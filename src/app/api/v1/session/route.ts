import { AppError } from "@/lib/errors";
import { profileComplete, requireActor } from "@/server/auth/actor";
import { revokeSession, readSessionToken, sessionCookie } from "@/server/auth/session";
import { apiError, apiOk, withApi } from "@/server/http";

export async function DELETE(request: Request): Promise<Response> {
  return withApi(request, "DELETE /api/v1/session", async ({ requestId }) => {
    const token = readSessionToken(request);
    if (token) await revokeSession(token);
    const response = apiOk({ signedOut: true }, requestId);
    response.headers.append("set-cookie", sessionCookie("", 0));
    return response;
  });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireActor(request, { allowInactive: true });
    return apiOk(
      {
        uid: actor.uid,
        profileComplete: profileComplete(actor.user),
        status: actor.user.status,
      },
      "req_session",
    );
  } catch (error) {
    if (error instanceof AppError) return apiError(error, "req_session");
    return apiError(new AppError(401, "UNAUTHENTICATED", "Sign in to continue."), "req_session");
  }
}
