import { eq } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { requireActor } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { referralAccounts, referralCodes, referrals, rewardLedger, users } from "@/server/db/schema";
import { apiOk, readJson, withApi } from "@/server/http";
import { evaluateReferral } from "@/server/referrals/logic";
import type { UserStatus } from "@/types/domain";

const bodySchema = z.object({ code: z.string().min(4).max(32) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/referrals/validate", async ({ requestId }) => {
    const actor = await requireActor(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Enter a referral code.", { code: "Enter a referral code." });
    const code = parsed.data.code.trim().toUpperCase();
    const db = getDb();
    const codeRows = await db.select().from(referralCodes).where(eq(referralCodes.code, code)).limit(1);
    if (!codeRows[0]) throw new AppError(422, "BUSINESS_RULE_FAILED", "That referral code does not match.");
    const referrerUid = codeRows[0].userId;
    const [referrerRows, accountRows, existing] = await Promise.all([
      db.select().from(users).where(eq(users.id, referrerUid)).limit(1),
      db.select().from(referralAccounts).where(eq(referralAccounts.userId, referrerUid)).limit(1),
      db.select().from(referrals).where(eq(referrals.referredUserId, actor.uid)).limit(1),
    ]);
    const status = referrerRows[0]?.status;
    const referrerStatus: UserStatus = status === "disabled" || status === "deletion_pending" ? status : "active";
    const decision = evaluateReferral({
      code,
      referrerUid,
      referredUid: actor.uid,
      referrerStatus,
      existingReferralForReferred: Boolean(existing[0]),
      conversions: accountRows[0]?.conversions ?? 0,
    });
    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      const again = await tx.select().from(referrals).where(eq(referrals.referredUserId, actor.uid)).limit(1);
      if (again[0]) throw new AppError(409, "STATE_CONFLICT", "This account already has a referral.");
      await tx.insert(referrals).values({
        referredUserId: actor.uid,
        referrerUserId: referrerUid,
        code,
        qualified: decision.qualified,
        createdAt: now,
      });
      await tx.insert(referralAccounts).values({
        userId: referrerUid,
        code,
        conversions: decision.conversions,
        createdAt: accountRows[0]?.createdAt ?? now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: referralAccounts.userId,
        set: { conversions: decision.conversions, updatedAt: now },
      });
      if (decision.ledger) {
        await tx.insert(rewardLedger).values({
          id: createId("rwd"),
          referrerUserId: referrerUid,
          referredUserId: actor.uid,
          status: decision.ledger.status,
          rewardDays: decision.ledger.rewardDays,
          reason: decision.ledger.reason,
          createdAt: now,
        });
      }
    });
    return apiOk({
      accepted: true,
      qualified: decision.qualified,
      rewardEnabled: decision.rewardEnabled,
      message: decision.message,
      ledgerStatus: decision.ledger?.status ?? null,
    }, requestId);
  });
}
