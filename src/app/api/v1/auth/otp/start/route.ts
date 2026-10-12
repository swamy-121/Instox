import { z } from "zod";
import { AppError } from "@/lib/errors";
import { normalizePhone, startPhoneOtp } from "@/server/auth/credentials";
import { apiOk, assertRateLimit, clientKey, readJson, withApi } from "@/server/http";

const bodySchema = z.object({ phone: z.string().min(8).max(20) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/auth/otp/start", async ({ requestId }) => {
    assertRateLimit(clientKey(request, "otp"), 5, 60_000);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Enter a valid phone number.");
    }
    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      throw new AppError(400, "VALIDATION_ERROR", "Enter a valid phone number. Indian numbers are 10 digits starting from 6 to 9.");
    }
    const result = await startPhoneOtp(phone);
    return apiOk(result, requestId);
  });
}
