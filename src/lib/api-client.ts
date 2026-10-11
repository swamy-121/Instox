export type ApiFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  fields?: Record<string, string>;
  requestId?: string;
};

export type ApiSuccess<T> = {
  ok: true;
  status: number;
  data: T;
  nextCursor: string | null;
  requestId: string;
};

let tokenProvider: (() => Promise<string | null>) | null = null;

export function setTokenProvider(provider: () => Promise<string | null>): void {
  tokenProvider = provider;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiSuccess<T> | ApiFailure> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (tokenProvider) {
    const token = await tokenProvider();
    if (token) headers.set("authorization", `Bearer ${token}`);
  }
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: "include" });
  } catch {
    return {
      ok: false,
      status: 0,
      code: "PROVIDER_UNAVAILABLE",
      message: "The network request failed. Check your connection and try again.",
    };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const meta = record.meta && typeof record.meta === "object" ? (record.meta as Record<string, unknown>) : {};
  const requestId = typeof meta.requestId === "string" ? meta.requestId : undefined;

  if (!response.ok) {
    const error = record.error && typeof record.error === "object" ? (record.error as Record<string, unknown>) : {};
    return {
      ok: false,
      status: response.status,
      code: typeof error.code === "string" ? error.code : "INTERNAL_ERROR",
      message: typeof error.message === "string" ? error.message : "Something went wrong.",
      fields: error.fields && typeof error.fields === "object" ? (error.fields as Record<string, string>) : undefined,
      requestId,
    };
  }

  return {
    ok: true,
    status: response.status,
    data: record.data as T,
    nextCursor: typeof meta.nextCursor === "string" ? meta.nextCursor : null,
    requestId: requestId ?? "",
  };
}
