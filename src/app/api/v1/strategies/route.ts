import { z } from "zod";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";
import { assertStrategyDoesNotPublish, validateStrategy } from "@/server/strategies/model";

const bodySchema = z
  .object({
    name: z.string(),
    rules: z.array(z.unknown()).min(1).max(8),
    status: z.string().optional(),
    publish: z.boolean().optional(),
  })
  .strict();

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/strategies", async ({ requestId }) => {
    const actor = await requireActor(request);
    const snap = await adminDb().collection("strategies").where("uid", "==", actor.uid).limit(20).get();
    const strategies = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: String(data.name ?? ""),
        rules: data.rules ?? [],
        version: Number(data.version ?? 1),
        status: "draft",
        updatedAt: String(data.updatedAt ?? ""),
      };
    });
    return apiOk({ strategies, note: "Strategies stay in draft. They do not publish tips." }, requestId);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/strategies", async ({ requestId }) => {
    const actor = await requireActor(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "A strategy needs a name and rules.", { form: "Check the strategy." });
    }
    assertStrategyDoesNotPublish(parsed.data);
    const draft = validateStrategy(parsed.data, 1);
    const id = createId("str");
    const now = new Date().toISOString();
    await adminDb().collection("strategies").doc(id).set({
      id,
      uid: actor.uid,
      ...draft,
      createdAt: now,
      updatedAt: now,
    });
    return apiOk({ strategy: { id, ...draft, updatedAt: now } }, requestId, null, 201);
  });
}
