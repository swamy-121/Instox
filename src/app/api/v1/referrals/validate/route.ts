import { z } from "zod";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, readJson, withApi } from "@/server/http";
import { evaluateReferral } from "@/server/referrals/logic";
import type { UserStatus } from "@/types/domain";

const bodySchema = z.object({ code: z.string().min(4).max(32) }).strict();

export async function POST(request: Request): Promise<Response> {
  return withApi(request, "POST /api/v1/referrals/validate", async ({ requestId }) => {
    const actor = await requireActor(request);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Enter a referral code.", { code: "Enter a referral code." });
    }
    const code = parsed.data.code.trim().toUpperCase();
    const db = adminDb();
    const codeSnap = await db.collection("referralCodes").doc(code).get();
    if (!codeSnap.exists) {
      throw new AppError(422, "BUSINESS_RULE_FAILED", "That referral code does not match.");
    }
    const referrerUid = String(codeSnap.data()?.uid ?? "");
    const [referrerSnap, accountSnap, existing] = await Promise.all([
      db.collection("users").doc(referrerUid).get(),
      db.collection("referralAccounts").doc(referrerUid).get(),
      db.collection("referrals").doc(actor.uid).get(),
    ]);
    const status = referrerSnap.data()?.status;
    const referrerStatus: UserStatus = status === "disabled" || status === "deletion_pending" ? status : "active";
    const decision = evaluateReferral({
      code,
      referrerUid,
      referredUid: actor.uid,
      referrerStatus,
      existingReferralForReferred: existing.exists,
      conversions: Number(accountSnap.data()?.conversions ?? 0),
    });
    const now = new Date().toISOString();
    await db.runTransaction(async (tx) => {
      const referralRef = db.collection("referrals").doc(actor.uid);
      const accountRef = db.collection("referralAccounts").doc(referrerUid);
      const again = await tx.get(referralRef);
      if (again.exists) {
        throw new AppError(409, "STATE_CONFLICT", "This account already has a referral.");
      }
      tx.set(referralRef, {
        referredUid: actor.uid,
        referrerUid,
        code,
        qualified: decision.qualified,
        createdAt: now,
      });
      tx.set(
        accountRef,
        { uid: referrerUid, code, conversions: decision.conversions, updatedAt: now },
        { merge: true },
      );
      if (decision.ledger) {
        const ledgerId = createId("rwd");
        tx.set(db.collection("rewardLedger").doc(ledgerId), {
          id: ledgerId,
          referrerUid,
          referredUid: actor.uid,
          status: decision.ledger.status,
          rewardDays: decision.ledger.rewardDays,
          reason: decision.ledger.reason,
          createdAt: now,
        });
      }
    });
    return apiOk(
      {
        accepted: true,
        qualified: decision.qualified,
        rewardEnabled: decision.rewardEnabled,
        message: decision.message,
        ledgerStatus: decision.ledger?.status ?? null,
      },
      requestId,
    );
  });
}
