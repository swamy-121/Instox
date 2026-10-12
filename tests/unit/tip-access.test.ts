import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { toE164 } from "@/lib/phone";
import { priceOrder, resetPlanCache } from "@/server/payments/plans";
import { nextPaymentStatus } from "@/server/payments/order-state";
import { lockedFieldNames, presentTip } from "@/server/tips/present";
import { validateTipInput, type TipInput } from "@/lib/validation/tip";
import type { TipRecord } from "@/types/domain";
import { z } from "zod";

const compliance = {
  riskDisclosureVersion: "2026-10-11-draft",
  pennyStockPublishEnabled: false,
  consentVersion: "2026-10-11-draft",
  prohibitedClaims: ["guaranteed return", "sure shot"],
};

const instruments = [
  { symbol: "RELIANCE", segment: "equity" as const, tickSize: 0.05, eligible: true },
  { symbol: "BANKNIFTY", segment: "options" as const, tickSize: 0.05, eligible: true },
];

function equity(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "RELIANCE",
    category: "equity",
    side: "BUY",
    entryMin: 2500,
    entryMax: null,
    stopLoss: 2450,
    targets: [
      { label: "T1", price: 2550 },
      { label: "T2", price: 2600 },
    ],
    timeframe: "2-5 sessions",
    thesis: "Price is holding a prior demand area with room toward the first target.",
    riskDisclosureVersion: compliance.riskDisclosureVersion,
    accessTier: "free",
    ...overrides,
  };
}

function asRecord(input: TipInput, overrides: Partial<TipRecord> = {}): TipRecord {
  return {
    ...input,
    id: "tip_test",
    status: "published",
    closeReason: null,
    publishedAt: "2026-10-11T10:00:00.000Z",
    createdBy: "seed_publisher",
    updatedBy: "seed_publisher",
    createdAt: "2026-10-11T09:00:00.000Z",
    updatedAt: "2026-10-11T10:00:00.000Z",
    schemaVersion: 1,
    version: 3,
    ...overrides,
  };
}

describe("tip validation and premium redaction", () => {
  it("accepts a valid equity tip and rejects bad stops, claims, and option fields", () => {
    const valid = validateTipInput(equity(), { instruments, compliance });
    expect(valid.symbol).toBe("RELIANCE");
    expect(valid.targets).toHaveLength(2);

    expect(() => validateTipInput(equity({ stopLoss: 2600 }), { instruments, compliance })).toThrow(AppError);
    expect(() => validateTipInput(equity({ thesis: "This is a sure shot for the week ahead." }), { instruments, compliance })).toThrow(AppError);
    expect(() =>
      validateTipInput(equity({ category: "options", symbol: "BANKNIFTY" }), { instruments, compliance }),
    ).toThrow(AppError);

    const option = validateTipInput(
      equity({
        category: "options",
        symbol: "BANKNIFTY",
        optionType: "CE",
        strikePrice: 50000,
        expiry: "2026-12-31",
        underlying: "BANKNIFTY",
        lotSize: 15,
        entryMin: 200,
        stopLoss: 150,
        targets: [{ label: "T1", price: 260 }],
      }),
      { instruments, compliance },
    );
    expect(option.segment).toBe("options");
    expect(option.optionType).toBe("CE");
  });

  it("forces penny stocks to premium and blocks publishing them", () => {
    const draft = validateTipInput(equity({ category: "penny_stocks", accessTier: "free" }), { instruments, compliance });
    expect(draft.accessTier).toBe("premium");
    expect(() =>
      validateTipInput(equity({ category: "penny_stocks" }), {
        instruments,
        compliance,
        forPublish: true,
        now: new Date("2026-10-11T00:00:00.000Z"),
      }),
    ).toThrow(AppError);
  });

  it("never includes premium payloads for a free viewer", () => {
    const input = validateTipInput(equity({ accessTier: "premium", thesis: "Hidden premium rationale for members only." }), {
      instruments,
      compliance,
    });
    const view = presentTip(asRecord(input), "free");
    expect(view.locked).toBe(true);
    if (!view.locked) throw new Error("expected lock");
    expect(Object.keys(view).sort()).toEqual([...lockedFieldNames()].sort());
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("Hidden premium");
    expect(serialized).not.toContain("entryMin");
    expect(serialized).not.toContain("stopLoss");
    expect(presentTip(asRecord(input), "premium").locked).toBe(false);
    expect(presentTip(asRecord(input, { accessTier: "free" }), "free").locked).toBe(false);
  });
});

describe("payments stay server priced", () => {
  it("prices an order from config and rejects client payment fields", () => {
    resetPlanCache();
    expect(priceOrder("premium_monthly").amountMinor).toBe(9900);
    expect(priceOrder("premium_monthly", [
      {
        id: "premium_monthly",
        name: "Test",
        description: "Test",
        priceMinor: 1234,
        currency: "INR",
        billingPeriod: "monthly",
        features: [],
        active: true,
        approved: false,
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        taxTreatment: "unapproved",
        placeholder: true,
      },
    ]).amountMinor).toBe(1234);

    const body = z.object({ planId: z.string() }).strict();
    expect(body.safeParse({ planId: "premium_monthly", amountMinor: 1, isPaid: true }).success).toBe(false);
  });

  it("refuses unverified, mismatched, and duplicate payment events", () => {
    const order = { amountMinor: 9900, currency: "INR" };
    expect(() =>
      nextPaymentStatus("created", {
        providerEventId: "evt_1",
        eventType: "payment.captured",
        signatureVerified: false,
        amountMinor: 9900,
        currency: "INR",
      }, order, new Set()),
    ).toThrow(AppError);

    expect(() =>
      nextPaymentStatus("created", {
        providerEventId: "evt_1",
        eventType: "payment.captured",
        signatureVerified: true,
        amountMinor: 100,
        currency: "INR",
      }, order, new Set()),
    ).toThrow(AppError);

    const first = nextPaymentStatus("created", {
      providerEventId: "evt_1",
      eventType: "payment.captured",
      signatureVerified: true,
      amountMinor: 9900,
      currency: "INR",
    }, order, new Set());
    expect(first).toEqual({ status: "paid_verified", duplicate: false });

    const duplicate = nextPaymentStatus("paid_verified", {
      providerEventId: "evt_1",
      eventType: "payment.captured",
      signatureVerified: true,
      amountMinor: 9900,
      currency: "INR",
    }, order, new Set(["evt_1"]));
    expect(duplicate).toEqual({ status: "paid_verified", duplicate: true });
  });
});

describe("public cache boundaries", () => {
  it("keeps the service worker off authenticated and API responses", () => {
    const source = readFileSync("public/sw.js", "utf8");
    const precache = source.slice(source.indexOf("const PRECACHE"), source.indexOf("];"));
    expect(precache).not.toContain("/api/");
    expect(precache).not.toContain("/tips");
    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain('url.pathname.startsWith("/tips")');
    expect(source).toContain("/offline.html");
  });

  it("validates Indian phone numbers", () => {
    expect(toE164("91", "9876543210")).toBe("+919876543210");
    expect(toE164("+91", "12345")).toBeNull();
  });
});
