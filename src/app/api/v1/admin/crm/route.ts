import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireCrm } from "@/server/auth/operations";
import { applyPage } from "@/lib/list-page";
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
    const planId = url.searchParams.get("plan") ?? "";
    const matched = await listContacts({
      stage: url.searchParams.get("stage") ?? undefined,
      trialEnding: url.searchParams.get("trialEnding") === "1",
      churned: url.searchParams.get("churned") === "1",
      q: url.searchParams.get("q") ?? undefined,
      kind: url.searchParams.get("kind") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    const plans = [...new Set(matched.map((row) => row.planId).filter((item): item is string => Boolean(item)))].sort();
    const contacts = planId ? matched.filter((row) => row.planId === planId) : matched;
    const window = applyPage(contacts, url.searchParams);
    return apiOk({ contacts: window.items, plans, total: window.total, page: window.page, pageSize: window.pageSize }, requestId);
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
