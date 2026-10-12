import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requestPasswordReset } from "@/server/auth/credentials";
import { apiOk, assertRateLimit, clientKey, readJson, withApi } from "@/server/http";

const bodySchema = z.object({ email: z.string().email().max(200) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/auth/password/forgot", async ({ requestId }) => {
    assertRateLimit(clientKey(request, "reset"), 5, 60_000);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Enter your email, then choose forgot password.");
    }
    const result = await requestPasswordReset(parsed.data.email);
    return apiOk(result, requestId);
  });
}
