import { eq } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireOperations } from "@/server/auth/operations";
import { getDb } from "@/server/db/client";
import { affiliates } from "@/server/db/schema";
import { apiOk, readJson, withApi } from "@/server/http";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  commissionBps: z.number().int().min(0).max(2000).optional(),
  status: z.enum(["active", "paused"]).optional(),
  notes: z.string().trim().max(400).optional(),
}).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withApi(request, "PATCH /api/v1/admin/affiliates/:id", async ({ requestId }) => {
    await requireOperations(request);
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Check the partner details.");
    const db = getDb();
    const existing = await db.select().from(affiliates).where(eq(affiliates.id, id)).limit(1);
    const current = existing[0];
    if (!current) throw new AppError(404, "NOT_FOUND", "That partner was not found.");
    const next = {
      name: parsed.data.name ?? current.name,
      commissionBps: parsed.data.commissionBps ?? current.commissionBps,
      status: parsed.data.status ?? current.status,
      notes: parsed.data.notes ?? current.notes,
      updatedAt: new Date().toISOString(),
    };
    await db.update(affiliates).set(next).where(eq(affiliates.id, id));
    return apiOk({
      affiliate: {
        id,
        code: current.code,
        ...next,
        commissionPct: next.commissionBps / 100,
        createdAt: current.createdAt,
      },
    }, requestId);
  });
}
