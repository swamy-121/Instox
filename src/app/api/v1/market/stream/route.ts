import { requireActor } from "@/server/auth/actor";
import { quoteCacheSnapshot } from "@/server/market-data/hub";
import { withApi } from "@/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/market/stream", async () => {
    await requireActor(request);
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | null = null;
    let closed = false;
    const stream = new ReadableStream({
      start(controller) {
        const send = () => {
          if (closed) return;
          const payload = JSON.stringify({ quotes: quoteCacheSnapshot() });
          try {
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          } catch {
            closed = true;
            if (timer) clearInterval(timer);
          }
        };
        send();
        timer = setInterval(send, 2000);
      },
      cancel() {
        closed = true;
        if (timer) clearInterval(timer);
      },
    });
    request.signal.addEventListener("abort", () => {
      closed = true;
      if (timer) clearInterval(timer);
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        connection: "keep-alive",
      },
    });
  });
}
