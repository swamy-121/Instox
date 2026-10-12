import { AppError, isAppError } from "@/lib/errors";
import { createRequestId } from "@/lib/ids";

const buckets = new Map<string, number[]>();

export function apiOk(
  data: unknown,
  requestId: string,
  nextCursor: string | null = null,
  status = 200,
): Response {
  return Response.json(
    { data, meta: { requestId, nextCursor } },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-request-id": requestId,
      },
    },
  );
}

export function apiError(error: AppError, requestId: string): Response {
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
      },
      meta: { requestId },
    },
    {
      status: error.status,
      headers: {
        "cache-control": "no-store",
        "x-request-id": requestId,
        ...(error.code === "RATE_LIMITED" ? { "retry-after": "30" } : {}),
      },
    },
  );
}

export function assertSameOrigin(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin) {
    const bearer = request.headers.get("authorization");
    if (bearer?.startsWith("Bearer ")) return;
    throw new AppError(403, "FORBIDDEN", "This action must come from the Instox app.");
  }
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError(403, "FORBIDDEN", "This action must come from the Instox app.");
  }
  if (!host || originHost !== host) {
    throw new AppError(403, "FORBIDDEN", "This action must come from the Instox app.");
  }
}

export function assertRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    throw new AppError(429, "RATE_LIMITED", "Too many requests. Wait a moment and try again.");
  }
  recent.push(now);
  buckets.set(key, recent);
}

export function clientKey(request: Request, bucket: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${bucket}:${forwarded || "local"}`;
}

function logLine(entry: { requestId: string; route: string; category: string; latencyMs: number }): void {
  console.info(JSON.stringify(entry));
}

export async function withApi(
  request: Request,
  route: string,
  handler: (ctx: { requestId: string }) => Promise<Response>,
  options?: { skipOriginCheck?: boolean },
): Promise<Response> {
  const requestId = createRequestId();
  const started = Date.now();
  try {
    if (!options?.skipOriginCheck) assertSameOrigin(request);
    const response = await handler({ requestId });
    logLine({ requestId, route, category: String(response.status), latencyMs: Date.now() - started });
    return response;
  } catch (error) {
    const appError = isAppError(error)
      ? error
      : new AppError(500, "INTERNAL_ERROR", "Something went wrong. Quote the request id if you need help.");
    if (!isAppError(error)) {
      console.error(JSON.stringify({ requestId, route, category: "INTERNAL_ERROR" }));
    }
    logLine({ requestId, route, category: appError.code, latencyMs: Date.now() - started });
    return apiError(appError, requestId);
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "Send a JSON body.");
  }
}

export function requireIdempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key")?.trim() ?? "";
  if (key.length < 8 || key.length > 80 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new AppError(400, "VALIDATION_ERROR", "Send an Idempotency-Key header.", {
      idempotencyKey: "Use 8 to 80 letters, numbers, or . _ : -",
    });
  }
  return key;
}
