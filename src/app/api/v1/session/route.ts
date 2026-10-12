import { z } from "zod";
import { AppError } from "@/lib/errors";
import { profileComplete, requireActor } from "@/server/auth/actor";
import { adminAuth } from "@/server/db/admin";
import { apiError, apiOk, assertRateLimit, clientKey, readJson, withApi } from "@/server/http";
import { bootstrapUser } from "@/server/users/repo";

const bodySchema = z.object({ idToken: z.string().min(20) }).strict();

function sessionCookie(value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `instox_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/session", async ({ requestId }) => {
    assertRateLimit(clientKey(request, "session"), 20, 60_000);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "A valid sign-in token is required.");
    }
    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(parsed.data.idToken);
    } catch {
      throw new AppError(401, "UNAUTHENTICATED", "That sign-in token was rejected.");
    }
    const { emailConflict } = await bootstrapUser(decoded);
    const expiresIn = 5 * 24 * 60 * 60 * 1000;
    const cookie = await adminAuth().createSessionCookie(parsed.data.idToken, { expiresIn });
    const response = apiOk({ uid: decoded.uid, emailConflict }, requestId);
    response.headers.append("set-cookie", sessionCookie(cookie, Math.floor(expiresIn / 1000)));
    return response;
  });
}

export async function DELETE(request: Request): Promise<Response> {
  return withApi(request, "DELETE /api/v1/session", async ({ requestId }) => {
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
