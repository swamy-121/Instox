import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { apiOk, readJson, withApi } from "@/server/http";
import { listMemberAlerts, readAlertPrefs, writeAlertPrefs } from "@/server/tips/library";

const bodySchema = z.object({
  targetHit: z.boolean(),
  stopLoss: z.boolean(),
  expired: z.boolean(),
}).strict();

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/tip-alerts", async ({ requestId }) => {
    const actor = await requireActor(request);
    const [prefs, alerts] = await Promise.all([readAlertPrefs(actor.uid), listMemberAlerts(actor.uid)]);
    return apiOk({ prefs, alerts }, requestId);
  });
}

export async function PUT(request: Request): Promise<Response> {
  return withApi(request, "PUT /api/v1/tip-alerts", async ({ requestId }) => {
    const actor = await requireActor(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Choose which result notes you want.");
    const prefs = await writeAlertPrefs(actor.uid, parsed.data);
    return apiOk({ prefs }, requestId);
  });
}
