import { eq } from "drizzle-orm";
import { requireActor } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { referralAccounts, referralCodes, referrals, rewardLedger } from "@/server/db/schema";
import { apiOk, withApi } from "@/server/http";
import { referralCodeFor } from "@/server/referrals/logic";
import features from "../../../../../../config/features.json";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/referrals/me", async ({ requestId }) => {
    const actor = await requireActor(request);
    const code = referralCodeFor(actor.uid);
    const db = getDb();
    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      const codeRow = await tx.select().from(referralCodes).where(eq(referralCodes.code, code)).limit(1);
      const accountRow = await tx.select().from(referralAccounts).where(eq(referralAccounts.userId, actor.uid)).limit(1);
      if (!codeRow[0]) await tx.insert(referralCodes).values({ code, userId: actor.uid, createdAt: now });
      if (!accountRow[0]) {
        await tx.insert(referralAccounts).values({ userId: actor.uid, code, conversions: 0, createdAt: now, updatedAt: now });
      }
    });
    const [accountRows, usedRows, ledgerRows] = await Promise.all([
      db.select().from(referralAccounts).where(eq(referralAccounts.userId, actor.uid)).limit(1),
      db.select().from(referrals).where(eq(referrals.referredUserId, actor.uid)).limit(1),
      db.select().from(rewardLedger).where(eq(rewardLedger.referrerUserId, actor.uid)).limit(20),
    ]);
    return apiOk({
      code,
      conversions: accountRows[0]?.conversions ?? 0,
      threshold: features.referrals.qualifiedCount,
      rewardEnabled: features.referrals.rewardEnabled,
      rewardGrantsEntitlement: features.referrals.rewardGrantsEntitlement,
      rewardDays: features.referrals.rewardDays,
      usedCode: usedRows[0] ? usedRows[0].code : null,
      ledger: ledgerRows.map((row) => ({
        id: row.id,
        status: row.status,
        rewardDays: row.rewardDays,
        reason: row.reason,
        createdAt: row.createdAt,
      })),
      message: features.referrals.rewardEnabled
        ? "Rewards follow the configured threshold."
        : "Referral rewards are turned off until the reward rule is approved. Sharing a code does not grant premium.",
    }, requestId);
  });
}
