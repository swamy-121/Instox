import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireCrm } from "@/server/auth/operations";
import { createLead, listContacts } from "@/server/crm/repo";
import { apiOk, readJson, withApi } from "@/server/http";

const createSchema = z.object({
  name: z.string().max(80),
  phone: z.string().max(20),
  email: z.string().max(120).optional(),
}).strict();

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/crm", async ({ requestId }) => {
    await requireCrm(request);
    const url = new URL(request.url);
    const contacts = await listContacts({
      stage: url.searchParams.get("stage") ?? undefined,
      planId: url.searchParams.get("plan") ?? undefined,
      trialEnding: url.searchParams.get("trialEnding") === "1",
      churned: url.searchParams.get("churned") === "1",
      q: url.searchParams.get("q") ?? undefined,
    });
    return apiOk({ contacts }, requestId);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/crm", async ({ requestId }) => {
    const actor = await requireCrm(request);
    const parsed = createSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Check the lead.", { form: "Name and phone are required." });
    const id = await createLead({ ...parsed.data, authorId: actor.uid });
    return apiOk({ id }, requestId, null, 201);
  });
}
