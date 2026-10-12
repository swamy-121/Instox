import { z } from "zod";
import { AppError } from "@/lib/errors";
import { attachSession, normalizePhone, REMEMBER_SECONDS, verifyPhoneOtp } from "@/server/auth/credentials";
import { apiOk, assertRateLimit, clientKey, readJson, withApi } from "@/server/http";

const bodySchema = z.object({ phone: z.string().min(8).max(20), code: z.string().regex(/^\d{6}$/) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/auth/otp/verify", async ({ requestId }) => {
    assertRateLimit(clientKey(request, "otp-verify"), 10, 60_000);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Enter the 6 digit code.");
    }
    const phone = normalizePhone(parsed.data.phone);
    if (!phone) throw new AppError(400, "VALIDATION_ERROR", "Enter a valid phone number.");
    const result = await verifyPhoneOtp(phone, parsed.data.code);
    return attachSession(
      apiOk({ uid: result.uid, emailConflict: result.emailConflict }, requestId),
      result.token,
      REMEMBER_SECONDS,
    );
  });
}
