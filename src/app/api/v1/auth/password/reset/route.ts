import { z } from "zod";
import { AppError } from "@/lib/errors";
import { resetPassword } from "@/server/auth/credentials";
import { apiOk, readJson, withApi } from "@/server/http";

const bodySchema = z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(200) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/auth/password/reset", async ({ requestId }) => {
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "That reset link is no longer valid.");
    }
    await resetPassword(parsed.data.token, parsed.data.password);
    return apiOk({ reset: true }, requestId);
  });
}
