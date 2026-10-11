import { requireOperations } from "@/server/auth/operations";
import { adminDb } from "@/server/db/admin";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/referrals", async ({ requestId }) => {
    await requireOperations(request);
    const db = adminDb();
    const [accounts, referrals, ledger] = await Promise.all([
      db.collection("referralAccounts").limit(100).get(),
      db.collection("referrals").limit(100).get(),
      db.collection("rewardLedger").limit(100).get(),
    ]);
    return apiOk(
      {
        accounts: accounts.docs.map((doc) => ({
          uid: doc.id,
          code: String(doc.data().code ?? ""),
          conversions: Number(doc.data().conversions ?? 0),
        })),
        referrals: referrals.docs.map((doc) => ({
          referredUid: doc.id,
          referrerUid: String(doc.data().referrerUid ?? ""),
          code: String(doc.data().code ?? ""),
          qualified: doc.data().qualified === true,
          createdAt: String(doc.data().createdAt ?? ""),
        })),
        ledger: ledger.docs.map((doc) => ({
          id: doc.id,
          referrerUid: String(doc.data().referrerUid ?? ""),
          status: String(doc.data().status ?? ""),
          rewardDays: Number(doc.data().rewardDays ?? 0),
          reason: String(doc.data().reason ?? ""),
        })),
      },
      requestId,
    );
  });
}
