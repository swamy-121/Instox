import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import compliance from "../config/compliance.json";
import features from "../config/features.json";
import plans from "../config/plans.json";
import { sampleInstruments } from "../src/server/market-data/instruments";
import { referralCodeFor } from "../src/server/referrals/logic";
import { seedCatalog } from "./seed-content";

function loadEnvFile(filePath: string) {
  try {
    const text = readFileSync(filePath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local is optional when the variables are already exported.
  }
}

loadEnvFile(".env.local");

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-instox";
const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (usingEmulator && (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)) {
  console.error("Set both FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST, or neither.");
  process.exit(1);
}

if (!usingEmulator && (!clientEmail || !privateKey)) {
  console.error("Set the emulator hosts, or set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY for a real project.");
  process.exit(1);
}

if (getApps().length === 0) {
  if (!usingEmulator && clientEmail && privateKey) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  } else {
    initializeApp({ projectId });
  }
}

const auth = getAuth();
const db = getFirestore();

const ADMIN_EMAIL = "admin@instox.app";
const ADMIN_PASSWORD = "Instox-seed-1";

type SeedUser = {
  uid: string;
  phoneNumber: string;
  displayName: string;
  roles: string[];
  status: "active" | "disabled";
  createdAt: string;
  email?: string;
  password?: string;
  tipPush?: boolean;
};

const users: SeedUser[] = [
  { uid: "seed_super", phoneNumber: "+919000000001", displayName: "Super Admin", roles: ["super_admin", "member"], status: "active", createdAt: "2026-09-18T04:00:00.000Z" },
  { uid: "seed_admin", phoneNumber: "+919000000002", displayName: "Admin User", roles: ["admin", "member"], status: "active", createdAt: "2026-09-20T04:00:00.000Z", email: ADMIN_EMAIL, password: ADMIN_PASSWORD, tipPush: true },
  { uid: "seed_publisher", phoneNumber: "+919000000003", displayName: "Publisher User", roles: ["publisher", "member"], status: "active", createdAt: "2026-09-25T04:00:00.000Z" },
  { uid: "seed_editor", phoneNumber: "+919000000004", displayName: "Editor User", roles: ["editor", "member"], status: "active", createdAt: "2026-10-01T04:00:00.000Z" },
  { uid: "seed_support", phoneNumber: "+919000000005", displayName: "Support User", roles: ["support", "member"], status: "active", createdAt: "2026-10-03T04:00:00.000Z" },
  { uid: "seed_free", phoneNumber: "+919000000006", displayName: "Free Member", roles: ["member"], status: "active", createdAt: "2026-10-06T04:00:00.000Z", tipPush: true },
  { uid: "seed_premium", phoneNumber: "+919000000007", displayName: "Premium Member", roles: ["member"], status: "active", createdAt: "2026-10-08T04:00:00.000Z", tipPush: true },
  { uid: "seed_disabled", phoneNumber: "+919000000008", displayName: "Disabled Member", roles: ["member"], status: "disabled", createdAt: "2026-10-10T04:00:00.000Z" },
  { uid: "seed_m01", phoneNumber: "+919100000001", displayName: "Rahul Sharma", roles: ["member"], status: "active", createdAt: "2026-08-20T04:00:00.000Z", tipPush: true },
  { uid: "seed_m02", phoneNumber: "+919100000002", displayName: "Priya Mehta", roles: ["member"], status: "active", createdAt: "2026-08-28T04:00:00.000Z", tipPush: true },
  { uid: "seed_m03", phoneNumber: "+919100000003", displayName: "Amit Kumar", roles: ["member"], status: "active", createdAt: "2026-09-02T04:00:00.000Z" },
  { uid: "seed_m04", phoneNumber: "+919100000004", displayName: "Sana Khan", roles: ["member"], status: "active", createdAt: "2026-09-08T04:00:00.000Z" },
  { uid: "seed_m05", phoneNumber: "+919100000005", displayName: "Neha Singh", roles: ["member"], status: "active", createdAt: "2026-09-16T04:00:00.000Z", tipPush: true },
  { uid: "seed_m06", phoneNumber: "+919100000006", displayName: "Arjun Patel", roles: ["member"], status: "active", createdAt: "2026-09-28T04:00:00.000Z" },
  { uid: "seed_m07", phoneNumber: "+919100000007", displayName: "Fatima Ali", roles: ["member"], status: "active", createdAt: "2026-10-02T04:00:00.000Z", tipPush: true },
  { uid: "seed_m08", phoneNumber: "+919100000008", displayName: "Vikram Reddy", roles: ["member"], status: "active", createdAt: "2026-10-05T04:00:00.000Z" },
  { uid: "seed_m09", phoneNumber: "+919100000009", displayName: "Ananya Iyer", roles: ["member"], status: "active", createdAt: "2026-09-04T04:00:00.000Z" },
  { uid: "seed_m10", phoneNumber: "+919100000010", displayName: "Rohit Verma", roles: ["member"], status: "active", createdAt: "2026-10-04T04:00:00.000Z" },
];

function sortKey(iso: string, id: string): string {
  return `${iso}_${id}`;
}

async function ensureAuthUser(user: SeedUser) {
  const extras = user.email && user.password ? { email: user.email, password: user.password, emailVerified: true } : {};
  try {
    await auth.getUser(user.uid);
    await auth.updateUser(user.uid, { displayName: user.displayName, phoneNumber: user.phoneNumber, ...extras });
  } catch {
    await auth.createUser({ uid: user.uid, displayName: user.displayName, phoneNumber: user.phoneNumber, ...extras });
  }
}

async function main() {
  const now = "2026-10-11T09:00:00.000Z";
  for (const user of users) {
    await ensureAuthUser(user);
    await db.collection("users").doc(user.uid).set({
      uid: user.uid,
      displayName: user.displayName,
      email: user.email ?? null,
      phoneNumber: user.phoneNumber,
      photoURL: null,
      status: user.status,
      locale: "en-IN",
      timezone: "Asia/Kolkata",
      createdAt: user.createdAt,
      updatedAt: now,
      consentVersion: compliance.consentVersion,
      consentAt: now,
      providers: ["custom"],
      tipPush: user.tipPush === true,
      marketingPush: false,
    });
    const code = referralCodeFor(user.uid);
    await db.collection("referralCodes").doc(code).set({ uid: user.uid, code, createdAt: now });
    await db.collection("referralAccounts").doc(user.uid).set({
      uid: user.uid,
      code,
      conversions: 0,
      createdAt: now,
      updatedAt: now,
    });
    await db.collection("userRoles").doc(user.uid).set({
      uid: user.uid,
      roles: user.roles,
      grantedBy: "seed",
      grantedAt: now,
      updatedAt: now,
    });
  }

  const entitlements = [
    { uid: "seed_premium", planId: "pro_monthly", status: "active", startsAt: "2026-10-08T00:00:00.000Z", endsAt: "2026-11-08T00:00:00.000Z" },
    { uid: "seed_m02", planId: "pro_monthly", status: "active", startsAt: "2026-08-28T00:00:00.000Z", endsAt: "2026-11-28T00:00:00.000Z" },
    { uid: "seed_m05", planId: "basic_monthly", status: "active", startsAt: "2026-09-16T00:00:00.000Z", endsAt: "2026-10-16T00:00:00.000Z" },
    { uid: "seed_m07", planId: "pro_yearly", status: "active", startsAt: "2026-10-02T00:00:00.000Z", endsAt: "2027-10-02T00:00:00.000Z" },
    { uid: "seed_m09", planId: "basic_monthly", status: "expired", startsAt: "2026-08-04T00:00:00.000Z", endsAt: "2026-09-04T00:00:00.000Z" },
    { uid: "seed_m10", planId: "pro_monthly", status: "revoked", startsAt: "2026-09-04T00:00:00.000Z", endsAt: "2026-10-04T00:00:00.000Z" },
  ];
  for (const row of entitlements) {
    await db.collection("userEntitlements").doc(row.uid).set({
      ...row,
      sourceOrderId: null,
      source: "seed",
      updatedAt: now,
      version: 1,
    });
  }

  const thesis = "Sample rationale for a fictional tip. This is not a recommendation to trade.";
  const base = {
    schemaVersion: 1,
    riskDisclosureVersion: compliance.riskDisclosureVersion,
    entryMax: null,
    optionType: null,
    strikePrice: null,
    expiry: null,
    underlying: null,
    lotSize: null,
    closeReason: null,
    expiresAt: null,
    createdBy: "seed_editor",
    updatedBy: "seed_publisher",
  };

  const tips = [
    {
      id: "tip_seed_draft",
      symbol: "RELIANCE",
      category: "equity",
      segment: "equity",
      side: "BUY",
      entryMin: 2500,
      stopLoss: 2450,
      targets: [{ label: "T1", price: 2550 }, { label: "T2", price: 2600 }],
      timeframe: "2-5 sessions",
      thesis,
      accessTier: "free",
      status: "draft",
      publishedAt: null,
      version: 1,
      createdAt: "2026-10-11T05:00:00.000Z",
    },
    {
      id: "tip_seed_review",
      symbol: "TCS",
      category: "short_term",
      segment: "equity",
      side: "BUY",
      entryMin: 4000,
      stopLoss: 3900,
      targets: [{ label: "T1", price: 4100 }],
      timeframe: "2-6 weeks",
      thesis,
      accessTier: "free",
      status: "in_review",
      publishedAt: null,
      version: 2,
      createdAt: "2026-10-10T05:00:00.000Z",
    },
    {
      id: "tip_seed_reliance",
      symbol: "RELIANCE",
      category: "equity",
      segment: "equity",
      side: "BUY",
      entryMin: 2845,
      stopLoss: 2780,
      targets: [{ label: "T1", price: 2890 }, { label: "T2", price: 2950 }, { label: "T3", price: 3020 }],
      timeframe: "2-5 sessions",
      thesis,
      accessTier: "free",
      status: "published",
      publishedAt: "2026-10-11T06:30:00.000Z",
      version: 2,
      createdAt: "2026-10-07T06:30:00.000Z",
    },
    {
      id: "tip_seed_free",
      symbol: "INFY",
      category: "equity",
      segment: "equity",
      side: "BUY",
      entryMin: 1800,
      stopLoss: 1750,
      targets: [{ label: "T1", price: 1860 }, { label: "T2", price: 1900 }],
      timeframe: "1-3 sessions",
      thesis,
      accessTier: "free",
      status: "published",
      publishedAt: "2026-10-10T10:00:00.000Z",
      version: 3,
      createdAt: "2026-10-05T10:00:00.000Z",
    },
    {
      id: "tip_seed_premium",
      symbol: "HDFCBANK",
      category: "equity",
      segment: "equity",
      side: "BUY",
      entryMin: 1700,
      stopLoss: 1650,
      targets: [{ label: "T1", price: 1750 }, { label: "T2", price: 1800 }, { label: "T3", price: 1850 }],
      timeframe: "1-2 weeks",
      thesis: "Premium sample rationale. Free clients must not receive this text.",
      accessTier: "premium",
      status: "published",
      publishedAt: "2026-10-11T08:00:00.000Z",
      version: 4,
      createdAt: "2026-10-03T08:00:00.000Z",
    },
    {
      id: "tip_seed_closed",
      symbol: "SBIN",
      category: "intraday",
      segment: "equity",
      side: "SELL",
      entryMin: 800,
      stopLoss: 820,
      targets: [{ label: "T1", price: 780 }],
      timeframe: "Same session",
      thesis,
      accessTier: "free",
      status: "closed",
      closeReason: "target_hit",
      publishedAt: "2026-10-09T08:00:00.000Z",
      version: 5,
      createdAt: "2026-09-29T08:00:00.000Z",
    },
    {
      id: "tip_seed_option",
      symbol: "BANKNIFTY",
      category: "options",
      segment: "options",
      side: "BUY",
      entryMin: 200,
      stopLoss: 150,
      targets: [{ label: "T1", price: 260 }],
      optionType: "CE",
      strikePrice: 52000,
      expiry: "2026-12-31",
      underlying: "BANKNIFTY",
      lotSize: 15,
      timeframe: "Until weekly expiry",
      thesis,
      accessTier: "premium",
      status: "published",
      publishedAt: "2026-10-11T07:00:00.000Z",
      version: 2,
      createdAt: "2026-10-01T07:00:00.000Z",
    },
    {
      id: "tip_seed_nifty",
      symbol: "NIFTY",
      category: "futures",
      segment: "futures",
      side: "BUY",
      entryMin: 24600,
      stopLoss: 24350,
      targets: [{ label: "T1", price: 24850 }, { label: "T2", price: 25100 }],
      expiry: "2026-10-29",
      timeframe: "Until monthly expiry",
      thesis,
      accessTier: "premium",
      status: "published",
      publishedAt: "2026-10-06T07:00:00.000Z",
      version: 1,
      createdAt: "2026-10-06T06:00:00.000Z",
    },
    {
      id: "tip_seed_btst",
      symbol: "TCS",
      category: "btst",
      segment: "equity",
      side: "SELL",
      entryMin: 3990,
      stopLoss: 4050,
      targets: [{ label: "T1", price: 3920 }, { label: "T2", price: 3880 }],
      timeframe: "Next session",
      thesis,
      accessTier: "free",
      status: "published",
      publishedAt: "2026-10-04T07:00:00.000Z",
      version: 1,
      createdAt: "2026-10-04T06:00:00.000Z",
    },
    {
      id: "tip_seed_long",
      symbol: "INFY",
      category: "long_term",
      segment: "equity",
      side: "BUY",
      entryMin: 1460,
      stopLoss: 1380,
      targets: [{ label: "T1", price: 1550 }, { label: "T2", price: 1620 }, { label: "T3", price: 1720 }],
      timeframe: "6-12 months",
      thesis,
      accessTier: "free",
      status: "published",
      publishedAt: "2026-09-22T07:00:00.000Z",
      version: 1,
      createdAt: "2026-09-22T06:00:00.000Z",
    },
    {
      id: "tip_seed_penny",
      symbol: "SBIN",
      category: "penny_stocks",
      segment: "equity",
      side: "BUY",
      entryMin: 42,
      stopLoss: 38,
      targets: [{ label: "T1", price: 48 }],
      timeframe: "2-4 weeks",
      thesis,
      accessTier: "premium",
      status: "draft",
      publishedAt: null,
      version: 1,
      createdAt: "2026-10-09T06:00:00.000Z",
    },
    {
      id: "tip_seed_prev",
      symbol: "RELIANCE",
      category: "equity",
      segment: "equity",
      side: "BUY",
      entryMin: 2700,
      stopLoss: 2620,
      targets: [{ label: "T1", price: 2780 }],
      timeframe: "1-2 weeks",
      thesis,
      accessTier: "free",
      status: "draft",
      publishedAt: null,
      version: 1,
      createdAt: "2026-08-22T06:00:00.000Z",
    },
  ];

  for (const tip of tips) {
    const createdAt = tip.createdAt;
    const updatedAt = tip.publishedAt ?? now;
    await db.collection("tips").doc(tip.id).set({
      ...base,
      ...tip,
      instrumentId: tip.symbol,
      createdAt,
      updatedAt,
      featured: tip.id === "tip_seed_free" || tip.id === "tip_seed_reliance",
      publishedSort: tip.publishedAt ? sortKey(tip.publishedAt, tip.id) : null,
      updatedSort: sortKey(updatedAt, tip.id),
    });
    await db.collection("tipEvents").doc(`evt_${tip.id}`).set({
      id: `evt_${tip.id}`,
      tipId: tip.id,
      eventType: tip.status === "published" ? "published" : "draft_created",
      oldStatus: null,
      newStatus: tip.status,
      oldVersion: null,
      newVersion: tip.version,
      reason: "Seeded sample tip",
      actorUid: "seed_publisher",
      occurredAt: updatedAt,
      requestId: "req_seed",
      previous: null,
    });
  }

  for (const plan of plans.plans) {
    await db.collection("plans").doc(plan.id).set(plan);
  }
  for (const instrument of sampleInstruments()) {
    await db.collection("instruments").doc(instrument.symbol).set(instrument);
  }
  await db.collection("appConfig").doc("screener").set({
    ...features.indicators,
    updatedBy: "seed",
    updatedAt: now,
  });
  await db.collection("appConfig").doc("public").set({
    key: "public",
    value: { product: "instox", sampleData: true },
    version: 1,
    effectiveAt: now,
    updatedBy: "seed",
    updatedAt: now,
  });
  await db.collection("adminAuditLogs").doc("aud_seed").set({
    id: "aud_seed",
    actorUid: "seed",
    action: "seed.loaded",
    targetType: "system",
    targetId: "demo",
    reason: "Loaded sample users and tips",
    occurredAt: now,
    requestId: "req_seed",
  });

  const orders = [
    { id: "ord_seed_aug", uid: "seed_m02", planId: "pro_monthly", amountMinor: 29900, createdAt: "2026-08-28T05:00:00.000Z" },
    { id: "ord_seed_sep", uid: "seed_m05", planId: "basic_monthly", amountMinor: 9900, createdAt: "2026-09-16T05:00:00.000Z" },
    { id: "ord_seed_oct2", uid: "seed_m07", planId: "pro_yearly", amountMinor: 299900, createdAt: "2026-10-02T05:00:00.000Z" },
    { id: "ord_seed_oct8", uid: "seed_premium", planId: "pro_monthly", amountMinor: 29900, createdAt: "2026-10-08T05:00:00.000Z" },
  ];
  for (const order of orders) {
    await db.collection("paymentOrders").doc(order.id).set({
      ...order,
      provider: "seed",
      currency: "INR",
      status: "recorded",
      entitlementGranted: false,
      updatedAt: now,
    });
  }

  await db.collection("notificationCampaigns").doc("camp_seed_open").set({
    id: "camp_seed_open",
    title: "Market open",
    body: "A stored alert for the history tab. Nothing was sent.",
    audience: "all",
    kind: "broadcast",
    channel: "fcm",
    status: "skipped_unconfigured",
    createdBy: "seed_admin",
    createdAt: "2026-10-10T04:30:00.000Z",
    reason: "Seeded history row",
  });

  await db.collection("appConfig").doc("screenerPresets").set({
    rsiPeriod: 14,
    rsiBelow: 70,
    rsiAbove: 30,
    rsiSide: "below",
    emaPeriod: 20,
    emaSide: "above",
    cprSide: "inside",
    updatedBy: "seed",
    updatedAt: now,
  });

  await seedCatalog(db);
  console.log("Seeded Auth and Firestore data.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed failed");
  process.exit(1);
});
