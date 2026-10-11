import { z } from "zod";
import { AppError } from "@/lib/errors";
import { adminAuth } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";

const bodySchema = z.object({ uid: z.string().regex(/^seed_[a-z0-9_]+$/) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/dev/custom-token", async ({ requestId }) => {
    if (process.env.NODE_ENV === "production" || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      throw new AppError(404, "NOT_FOUND", "Not found.");
    }
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Unknown development user.");
    }
    const customToken = await adminAuth().createCustomToken(parsed.data.uid);
    return apiOk({ customToken, uid: parsed.data.uid }, requestId);
  });
}
