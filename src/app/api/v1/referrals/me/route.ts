import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, withApi } from "@/server/http";
import { referralCodeFor } from "@/server/referrals/logic";
import features from "../../../../../../config/features.json";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/referrals/me", async ({ requestId }) => {
    const actor = await requireActor(request);
    const code = referralCodeFor(actor.uid);
    const db = adminDb();
    const now = new Date().toISOString();
    const accountRef = db.collection("referralAccounts").doc(actor.uid);
    const codeRef = db.collection("referralCodes").doc(code);
    await db.runTransaction(async (tx) => {
      const accountSnap = await tx.get(accountRef);
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) tx.set(codeRef, { uid: actor.uid, code, createdAt: now });
      if (!accountSnap.exists) {
        tx.set(accountRef, { uid: actor.uid, code, conversions: 0, createdAt: now, updatedAt: now });
      }
    });
    const [accountSnap, usedSnap, ledgerSnap] = await Promise.all([
      accountRef.get(),
      db.collection("referrals").doc(actor.uid).get(),
      db.collection("rewardLedger").where("referrerUid", "==", actor.uid).limit(20).get(),
    ]);
    return apiOk(
      {
        code,
        conversions: Number(accountSnap.data()?.conversions ?? 0),
        threshold: features.referrals.qualifiedCount,
        rewardEnabled: features.referrals.rewardEnabled,
        rewardGrantsEntitlement: features.referrals.rewardGrantsEntitlement,
        rewardDays: features.referrals.rewardDays,
        usedCode: usedSnap.exists ? String(usedSnap.data()?.code ?? "") : null,
        ledger: ledgerSnap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            status: String(data.status ?? ""),
            rewardDays: Number(data.rewardDays ?? 0),
            reason: String(data.reason ?? ""),
            createdAt: String(data.createdAt ?? ""),
          };
        }),
        message: features.referrals.rewardEnabled
          ? "Rewards follow the configured threshold."
          : "Referral rewards are turned off until the reward rule is approved. Sharing a code does not grant premium.",
      },
      requestId,
    );
  });
}
