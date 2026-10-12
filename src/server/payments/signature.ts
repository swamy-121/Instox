import { createHmac, timingSafeEqual } from "node:crypto";

export function razorpayWebhookSignature(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

/** Cashfree signs timestamp + raw body and sends base64 HMAC-SHA256. */
export function cashfreeWebhookSignature(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}${rawBody}`).digest("base64");
}

export function signaturesMatch(expected: string, received: string | null): boolean {
  if (!received || !expected) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyRazorpaySignature(secret: string, rawBody: string, header: string | null): boolean {
  if (!secret) return false;
  return signaturesMatch(razorpayWebhookSignature(secret, rawBody), header);
}

export function verifyCashfreeSignature(
  secret: string,
  timestamp: string | null,
  rawBody: string,
  header: string | null,
): boolean {
  if (!secret || !timestamp) return false;
  return signaturesMatch(cashfreeWebhookSignature(secret, timestamp, rawBody), header);
}
