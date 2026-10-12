import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";
import { assertStrategyDoesNotPublish, nextStrategyVersion, validateStrategy } from "@/server/strategies/model";

const bodySchema = z
  .object({
    name: z.string(),
    rules: z.array(z.unknown()).min(1).max(8),
    status: z.string().optional(),
    publish: z.boolean().optional(),
  })
  .strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withApi(request, "PATCH /api/v1/strategies/:id", async ({ requestId }) => {
    const actor = await requireActor(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "A strategy needs a name and rules.", { form: "Check the strategy." });
    }
    assertStrategyDoesNotPublish(parsed.data);
    const { id } = await context.params;
    const ref = adminDb().collection("strategies").doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.uid !== actor.uid) {
      throw new AppError(404, "NOT_FOUND", "That strategy was not found.");
    }
    const version = nextStrategyVersion(Number(snap.data()?.version ?? 1));
    const draft = validateStrategy(parsed.data, version);
    const updatedAt = new Date().toISOString();
    await ref.update({ ...draft, updatedAt });
    return apiOk({ strategy: { id, ...draft, updatedAt } }, requestId);
  });
}
