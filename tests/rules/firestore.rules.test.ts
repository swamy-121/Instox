import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const [host, portText] = emulator.split(":");
  testEnv = await initializeTestEnvironment({
    projectId: "demo-instox",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host,
      port: Number(portText ?? 8080),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users/alice"), {
      uid: "alice",
      displayName: "Alice",
      status: "active",
      locale: "en-IN",
      timezone: "Asia/Kolkata",
      updatedAt: "2026-10-11T00:00:00.000Z",
    });
    await setDoc(doc(db, "users/bob"), {
      uid: "bob",
      displayName: "Bob",
      status: "active",
    });
    await setDoc(doc(db, "tips/tip_premium"), {
      symbol: "HDFCBANK",
      accessTier: "premium",
      thesis: "This premium rationale must not be readable by the client SDK.",
      status: "published",
    });
    await setDoc(doc(db, "userRoles/alice"), { uid: "alice", roles: ["member"] });
    await setDoc(doc(db, "userEntitlements/alice"), { uid: "alice", status: "active", planId: "premium_monthly" });
    await setDoc(doc(db, "plans/premium_monthly"), { name: "Premium monthly", priceMinor: 9900 });
    await setDoc(doc(db, "appConfig/public"), { key: "public", value: { product: "instox" } });
    await setDoc(doc(db, "appConfig/secret"), { key: "secret", value: { token: "nope" } });
    await setDoc(doc(db, "paymentEvents/evt_1"), { providerEventId: "evt_1", payloadHash: "abc" });
    await setDoc(doc(db, "referrals/alice"), { referredUid: "alice", code: "INXTEST" });
    await setDoc(doc(db, "pushSubscriptions/sub_1"), { uid: "alice", endpoint: "https://push.example/secret" });
    await setDoc(doc(db, "fcmTokens/tok_1"), { uid: "alice", token: "fcm-secret-token" });
    await setDoc(doc(db, "shopOrders/shop_1"), { uid: "alice", status: "held_unapproved", amountMinor: 49900 });
    await setDoc(doc(db, "strategies/str_1"), { uid: "alice", name: "Draft", status: "draft" });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("firestore rules", () => {
  it("lets a user read and update their own profile fields only", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(alice, "users/alice")));
    await assertSucceeds(
      updateDoc(doc(alice, "users/alice"), {
        displayName: "Alice N",
        updatedAt: "2026-10-11T01:00:00.000Z",
      }),
    );
    await assertFails(updateDoc(doc(alice, "users/alice"), { status: "disabled" }));
    await assertFails(updateDoc(doc(alice, "users/alice"), { roles: ["admin"] }));
  });

  it("blocks other users, anonymous reads, and self-serve role writes", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(alice, "users/bob")));
    await assertFails(getDoc(doc(anon, "users/alice")));
    await assertFails(setDoc(doc(alice, "userRoles/alice"), { roles: ["super_admin"] }));
    await assertFails(getDoc(doc(alice, "userRoles/alice")));
    await assertFails(getDoc(doc(alice, "userEntitlements/alice")));
  });

  it("hides tips, events, and audit logs from the client SDK", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(alice, "tips/tip_premium")));
    await assertFails(setDoc(doc(alice, "tips/tip_new"), { thesis: "nope", accessTier: "free" }));
    await assertFails(setDoc(doc(alice, "tipEvents/evt_1"), { tipId: "tip_premium", reason: "forged" }));
    await assertFails(setDoc(doc(alice, "adminAuditLogs/aud_1"), { action: "user.roles_updated" }));
    await assertFails(setDoc(doc(alice, "paymentOrders/ord_1"), { status: "paid_verified", amountMinor: 1 }));
    await assertFails(getDoc(doc(alice, "paymentEvents/evt_1")));
    await assertFails(getDoc(doc(alice, "referrals/alice")));
    await assertFails(getDoc(doc(alice, "pushSubscriptions/sub_1")));
    await assertFails(getDoc(doc(alice, "fcmTokens/tok_1")));
    await assertFails(getDoc(doc(alice, "shopOrders/shop_1")));
    await assertFails(getDoc(doc(alice, "strategies/str_1")));
    await assertFails(updateDoc(doc(alice, "users/alice"), { tipPush: true }));
  });

  it("allows public plan and public config reads only", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, "plans/premium_monthly")));
    await assertFails(setDoc(doc(anon, "plans/premium_monthly"), { priceMinor: 1 }));
    await assertSucceeds(getDoc(doc(anon, "appConfig/public")));
    await assertFails(getDoc(doc(anon, "appConfig/secret")));
  });
});
