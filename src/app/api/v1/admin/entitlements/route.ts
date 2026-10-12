import { z } from "zod";
import { AppError } from "@/lib/errors";
import { recordAudit } from "@/server/audit/log";
import { requireOperations } from "@/server/auth/operations";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";
import { loadPlans } from "@/server/payments/plans";

const bodySchema = z
  .object({
    uid: z.string().min(1).max(128),
    action: z.enum(["grant", "revoke"]),
    planId: z.string().min(1).max(64).optional(),
    days: z.number().int().min(1).max(366).optional(),
    reason: z.string().min(3).max(500),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/admin/entitlements", async ({ requestId }) => {
    const actor = await requireOperations(request, { recent: true });
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Entitlement changes need a user, an action, and a reason.", {
        reason: "Enter a reason.",
      });
    }
    const db = adminDb();
    const userSnap = await db.collection("users").doc(parsed.data.uid).get();
    if (!userSnap.exists) throw new AppError(404, "NOT_FOUND", "That user was not found.");
    const ref = db.collection("userEntitlements").doc(parsed.data.uid);
    const current = await ref.get();
    const now = new Date().toISOString();
    const version = Number(current.data()?.version ?? 0) + 1;

    if (parsed.data.action === "revoke") {
      await ref.set(
        { uid: parsed.data.uid, status: "revoked", source: "manual", updatedAt: now, version },
        { merge: true },
      );
      await recordAudit({
        actorUid: actor.uid,
        action: "entitlement.manual_revoke",
        targetType: "user",
        targetId: parsed.data.uid,
        reason: parsed.data.reason,
        requestId,
      });
      return apiOk({ uid: parsed.data.uid, status: "revoked", source: "manual" }, requestId);
    }

    const plan = loadPlans().plans.find((item) => item.id === parsed.data.planId);
    if (!plan || plan.id === "free") {
      throw new AppError(422, "BUSINESS_RULE_FAILED", "Choose a configured paid plan. This does not approve its price.");
    }
    if (!parsed.data.days) {
      throw new AppError(400, "VALIDATION_ERROR", "Enter how many days this manual grant lasts.", { days: "Enter 1 to 366 days." });
    }
    const endsAt = new Date(Date.now() + parsed.data.days * 24 * 60 * 60 * 1000).toISOString();
    await ref.set({
      uid: parsed.data.uid,
      planId: plan.id,
      status: "active",
      startsAt: now,
      endsAt,
      sourceOrderId: null,
      source: "manual",
      updatedAt: now,
      version,
    });
    await recordAudit({
      actorUid: actor.uid,
      action: "entitlement.manual_grant",
      targetType: "user",
      targetId: parsed.data.uid,
      reason: parsed.data.reason,
      requestId,
    });
    return apiOk(
      {
        uid: parsed.data.uid,
        status: "active",
        planId: plan.id,
        endsAt,
        source: "manual",
        planApproved: plan.approved,
        message: "Manual grant recorded. The plan price is still unapproved unless the plan config says otherwise.",
      },
      requestId,
    );
  });
}
