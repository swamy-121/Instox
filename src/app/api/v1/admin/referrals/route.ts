import { requireOperations } from "@/server/auth/operations";
import { getDb } from "@/server/db/client";
import { referralAccounts, referrals, rewardLedger } from "@/server/db/schema";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/referrals", async ({ requestId }) => {
    await requireOperations(request);
    const db = getDb();
    const [accounts, referralRows, ledger] = await Promise.all([
      db.select().from(referralAccounts).limit(100),
      db.select().from(referrals).limit(100),
      db.select().from(rewardLedger).limit(100),
    ]);
    return apiOk({
      accounts: accounts.map((row) => ({ uid: row.userId, code: row.code, conversions: row.conversions })),
      referrals: referralRows.map((row) => ({
        referredUid: row.referredUserId,
        referrerUid: row.referrerUserId,
        code: row.code,
        qualified: row.qualified,
        createdAt: row.createdAt,
      })),
      ledger: ledger.map((row) => ({
        id: row.id,
        referrerUid: row.referrerUserId,
        status: row.status,
        rewardDays: row.rewardDays,
        reason: row.reason,
      })),
    }, requestId);
  });
}
