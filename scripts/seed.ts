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

const users = [
  { uid: "seed_super", phoneNumber: "+919000000001", displayName: "Super Admin", roles: ["super_admin", "member"], status: "active" },
  { uid: "seed_admin", phoneNumber: "+919000000002", displayName: "Admin User", roles: ["admin", "member"], status: "active" },
  { uid: "seed_publisher", phoneNumber: "+919000000003", displayName: "Publisher User", roles: ["publisher", "member"], status: "active" },
  { uid: "seed_editor", phoneNumber: "+919000000004", displayName: "Editor User", roles: ["editor", "member"], status: "active" },
  { uid: "seed_support", phoneNumber: "+919000000005", displayName: "Support User", roles: ["support", "member"], status: "active" },
  { uid: "seed_free", phoneNumber: "+919000000006", displayName: "Free Member", roles: ["member"], status: "active" },
  { uid: "seed_premium", phoneNumber: "+919000000007", displayName: "Premium Member", roles: ["member"], status: "active" },
  { uid: "seed_disabled", phoneNumber: "+919000000008", displayName: "Disabled Member", roles: ["member"], status: "disabled" },
] as const;

function sortKey(iso: string, id: string): string {
  return `${iso}_${id}`;
}

async function ensureAuthUser(user: (typeof users)[number]) {
  try {
    await auth.getUser(user.uid);
    await auth.updateUser(user.uid, { displayName: user.displayName, phoneNumber: user.phoneNumber });
  } catch {
    await auth.createUser({ uid: user.uid, displayName: user.displayName, phoneNumber: user.phoneNumber });
  }
}

async function main() {
  const now = "2026-10-11T09:00:00.000Z";
  for (const user of users) {
    await ensureAuthUser(user);
    await db.collection("users").doc(user.uid).set({
      uid: user.uid,
      displayName: user.displayName,
      email: null,
      phoneNumber: user.phoneNumber,
      photoURL: null,
      status: user.status,
      locale: "en-IN",
      timezone: "Asia/Kolkata",
      createdAt: now,
      updatedAt: now,
      consentVersion: compliance.consentVersion,
      consentAt: now,
      providers: ["custom"],
      tipPush: false,
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

  await db.collection("userEntitlements").doc("seed_premium").set({
    uid: "seed_premium",
    planId: "premium_monthly",
    status: "active",
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2026-11-01T00:00:00.000Z",
    sourceOrderId: null,
    source: "seed",
    updatedAt: now,
    version: 1,
  });

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
    },
  ];

  for (const tip of tips) {
    const createdAt = "2026-10-09T08:00:00.000Z";
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

  await seedCatalog(db);
  console.log("Seeded Auth and Firestore data.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed failed");
  process.exit(1);
});
