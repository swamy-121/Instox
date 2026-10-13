import { timingSafeEqual } from "node:crypto";
import { createId } from "@/lib/ids";
import { requireOperations } from "@/server/auth/operations";
import { getDb } from "@/server/db/client";
import { jobRuns } from "@/server/db/schema";
import { apiOk, withApi } from "@/server/http";
import { runDailyTipJob } from "@/server/tips/daily-job";

function cronAuthorized(request: Request): boolean {
  const expected = process.env.JOB_SECRET?.trim() ?? "";
  const provided = request.headers.get("x-job-secret") ?? "";
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(request: Request): Promise<Response> {
  const cron = cronAuthorized(request);
  return withApi(request, "POST /api/v1/jobs/daily-tips", async ({ requestId }) => {
    const actorUid = cron ? "job_daily_tips" : (await requireOperations(request)).uid;
    const startedAt = new Date().toISOString();
    const summary = await runDailyTipJob({ actorUid, requestId });
    const finishedAt = new Date().toISOString();
    await getDb().insert(jobRuns).values({
      id: createId("job"),
      job: "daily-tips",
      status: summary.failures > 0 ? "partial" : "ok",
      summary: summary as unknown as Record<string, unknown>,
      actorId: actorUid,
      startedAt,
      finishedAt,
    });
    return apiOk({
      ...summary,
      notice: "Open ideas are checked against the latest price bar. With no end-of-day file, a sample last price can close an idea only when that price is already through the target or the stop.",
    }, requestId);
  }, { skipOriginCheck: cron });
}
