import { z } from "zod";
import { AppError } from "@/lib/errors";
import { attachSession, REMEMBER_SECONDS } from "@/server/auth/credentials";
import { createSession } from "@/server/auth/session";
import { apiOk, readJson, withApi } from "@/server/http";
import { findUserById } from "@/server/users/repo";

const bodySchema = z.object({ uid: z.string().regex(/^seed_[a-z0-9_]+$/) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/dev/demo-login", async ({ requestId }) => {
    if (process.env.NODE_ENV === "production") {
      throw new AppError(404, "NOT_FOUND", "Not found.");
    }
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Unknown development user.");
    const user = await findUserById(parsed.data.uid);
    if (!user) throw new AppError(404, "NOT_FOUND", "That demo account is not seeded.");
    const token = await createSession(user.id, REMEMBER_SECONDS);
    return attachSession(apiOk({ uid: user.id }, requestId), token, REMEMBER_SECONDS);
  });
}
