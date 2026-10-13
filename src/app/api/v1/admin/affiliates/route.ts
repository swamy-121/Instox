import { z } from "zod";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { requireOperations } from "@/server/auth/operations";
import { getDb } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/sql-error";
import { affiliates } from "@/server/db/schema";
import { apiOk, readJson, withApi } from "@/server/http";
import { desc } from "drizzle-orm";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().min(4).max(12).regex(/^[A-Za-z0-9]+$/).transform((value) => value.toUpperCase()),
  commissionBps: z.number().int().min(0).max(2000),
  notes: z.string().trim().max(400).optional(),
}).strict();

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/affiliates", async ({ requestId }) => {
    await requireOperations(request);
    const rows = await getDb().select().from(affiliates).orderBy(desc(affiliates.createdAt));
    return apiOk({
      affiliates: rows.map(present),
      note: "Commission here is a note for your records. It does not move money.",
    }, requestId);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/affiliates", async ({ requestId }) => {
    await requireOperations(request);
    const parsed = createSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Check the partner name, code, and commission.", {
        code: "Use 4 to 12 letters or numbers.",
      });
    }
    const now = new Date().toISOString();
    const row = {
      id: createId("aff"),
      name: parsed.data.name,
      code: parsed.data.code,
      commissionBps: parsed.data.commissionBps,
      status: "active",
      notes: parsed.data.notes ?? "",
      createdAt: now,
      updatedAt: now,
    };
    try {
      await getDb().insert(affiliates).values(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, "STATE_CONFLICT", "That partner code is already in use.");
      throw error;
    }
    return apiOk({ affiliate: present(row) }, requestId, null, 201);
  });
}

function present(row: {
  id: string;
  name: string;
  code: string;
  commissionBps: number;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    commissionBps: row.commissionBps,
    commissionPct: row.commissionBps / 100,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
