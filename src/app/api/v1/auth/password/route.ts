import { z } from "zod";
import { AppError } from "@/lib/errors";
import { attachSession, signInWithPassword } from "@/server/auth/credentials";
import { apiOk, assertRateLimit, clientKey, readJson, withApi } from "@/server/http";

const bodySchema = z
  .object({
    email: z.string().email().max(200),
    password: z.string().min(1).max(200),
    remember: z.boolean().optional(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/auth/password", async ({ requestId }) => {
    assertRateLimit(clientKey(request, "password"), 10, 60_000);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(401, "UNAUTHENTICATED", "Email or password is incorrect.");
    }
    const result = await signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
      remember: parsed.data.remember !== false,
    });
    return attachSession(apiOk({ uid: result.uid }, requestId), result.token, result.maxAge);
  });
}
