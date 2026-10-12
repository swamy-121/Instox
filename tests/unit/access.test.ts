import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { GET as getMe, PATCH as patchMe } from "@/app/api/v1/me/route";
import { GET as getPlans } from "@/app/api/v1/plans/route";
import { GET as getTip } from "@/app/api/v1/tips/[tipId]/route";
import { GET as getAudit } from "@/app/api/v1/admin/audit/route";
import { GET as getIntegrations } from "@/app/api/v1/admin/integrations/route";
import { GET as getUsers } from "@/app/api/v1/admin/users/route";
import { GET as getOrder } from "@/app/api/v1/payment-orders/route";
import { createSession } from "@/server/auth/session";
import { migrationSql, setDb, type Database } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { contentDocuments, paymentOrders, tips, userRoles, users } from "@/server/db/schema";
import { lockedFieldNames } from "@/server/tips/present";

let client: PGlite;
let token = "";

function call(path: string, init?: RequestInit, session = token): Request {
  const headers = new Headers(init?.headers);
  headers.set("host", "localhost");
  headers.set("origin", "http://localhost");
  if (session) headers.set("cookie", `instox_session=${session}`);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return new Request(`http://localhost${path}`, { ...init, headers });
}

beforeAll(async () => {
  process.env.SESSION_SECRET = "test-session-secret-value";
  client = new PGlite();
  await client.exec(migrationSql());
  const db = drizzle(client, { schema });
  setDb(db as unknown as Database);
  const now = "2026-10-11T00:00:00.000Z";
  await db.insert(users).values({
    id: "member_1",
    displayName: "Member One",
    email: null,
    phoneNumber: "+919811111111",
    status: "active",
    locale: "en-IN",
    timezone: "Asia/Kolkata",
    consentVersion: "2026-10",
    consentAt: now,
    providers: ["phone"],
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(userRoles).values({
    userId: "member_1",
    roles: ["member"],
    grantedBy: "test",
    grantedAt: now,
    updatedAt: now,
  });
  await db.insert(contentDocuments).values({
    collection: "plans",
    id: "pro_monthly",
    body: {
      id: "pro_monthly",
      name: "Pro",
      description: "Unapproved.",
      priceMinor: 29900,
      currency: "INR",
      billingPeriod: "monthly",
      features: ["Premium tips"],
      active: true,
      approved: false,
      effectiveFrom: now,
      taxTreatment: "unapproved",
      placeholder: true,
    },
    status: null,
    sort: 0,
    active: true,
  });
  await db.insert(tips).values({
    id: "tip_locked",
    symbol: "HDFCBANK",
    instrumentId: "HDFCBANK",
    segment: "equity",
    category: "equity",
    side: "BUY",
    entryMin: 1700,
    entryMax: null,
    stopLoss: 1650,
    targets: [{ label: "T1", price: 1750 }],
    timeframe: "1 week",
    thesis: "Premium rationale that must stay on the server.",
    riskDisclosureVersion: "v1",
    accessTier: "premium",
    status: "published",
    createdBy: "member_1",
    updatedBy: "member_1",
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    version: 1,
    featured: false,
    publishedSort: `${now}_tip_locked`,
    updatedSort: `${now}_tip_locked`,
    publishedAt: now,
  });
  await db.insert(paymentOrders).values({
    id: "ord_other",
    userId: "someone_else",
    planId: "pro_monthly",
    provider: "stub",
    amountMinor: 29900,
    currency: "INR",
    status: "created",
    createdAt: now,
    placeholder: true,
    entitlementGranted: false,
  });
  token = await createSession("member_1", 3600);
}, 60_000);

afterAll(async () => {
  await client.close();
});

describe("api authorization", () => {
  it("lets a member update their own profile fields and rejects role writes", async () => {
    const updated = await patchMe(call("/api/v1/me", { method: "PATCH", body: JSON.stringify({ displayName: "Member N" }) }));
    expect(updated.status).toBe(200);
    const body = await updated.json();
    expect(body.data.displayName).toBe("Member N");
    expect(body.data.roles).toEqual(["member"]);

    const rejected = await patchMe(call("/api/v1/me", { method: "PATCH", body: JSON.stringify({ status: "disabled" }) }));
    expect(rejected.status).toBe(400);
  });

  it("hides other users, audit, integrations, and someone else's order", async () => {
    expect((await getUsers(call("/api/v1/admin/users"))).status).toBe(403);
    expect((await getAudit(call("/api/v1/admin/audit"))).status).toBe(403);
    expect((await getIntegrations(call("/api/v1/admin/integrations"))).status).toBe(403);
    expect((await getOrder(call("/api/v1/payment-orders?orderId=ord_other"))).status).toBe(404);
    expect((await getMe(new Request("http://localhost/api/v1/me"))).status).toBe(401);
  });

  it("serves unapproved plans without a session and locks a premium tip", async () => {
    const plans = await getPlans(new Request("http://localhost/api/v1/plans"));
    expect(plans.status).toBe(200);
    const planBody = await plans.json();
    expect(planBody.data.plans[0].approved).toBe(false);

    const tip = await getTip(new Request("http://localhost/api/v1/tips/tip_locked"), { params: Promise.resolve({ tipId: "tip_locked" }) });
    expect(tip.status).toBe(200);
    const tipBody = await tip.json();
    expect(Object.keys(tipBody.data.tip).sort()).toEqual([...lockedFieldNames()].sort());
    expect(tipBody.data.tip.locked).toBe(true);
    expect(tipBody.data.tip.thesis).toBeUndefined();
  });
});
