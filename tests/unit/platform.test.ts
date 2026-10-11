import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { defaultIndicatorFlags } from "@/server/indicators/flags";
import type { Candle } from "@/server/indicators/formulas";
import { pulseScore } from "@/server/indicators/pulse";
import { buildInsightReport, type InsightTip } from "@/server/insights/report";
import { validateInstrumentImport, type InstrumentMaster } from "@/server/market-data/instruments";
import { assertPushConsent, pushDeliveryPlan, safePushPayload } from "@/server/notifications/push";
import { applyPaymentEvent, entitlementEffect } from "@/server/payments/apply-event";
import { CashfreePaymentProvider, RazorpayPaymentProvider, parseCashfreeBody, parseRazorpayBody } from "@/server/payments/adapter";
import { accessDaysForPlan } from "@/server/payments/access-window";
import { reconcilePayments } from "@/server/payments/reconcile";
import { cashfreeWebhookSignature, razorpayWebhookSignature } from "@/server/payments/signature";
import { cancellationKeepsAccessUntil, nextSubscriptionStatus } from "@/server/payments/subscription";
import { evaluateReferral, referralCodeFor } from "@/server/referrals/logic";
import { runScreener } from "@/server/screener/engine";
import { filtersFromSearchParams } from "@/server/screener/query";

const BODY = '{"event":"payment.captured","id":"evt_test_1"}';

function instrument(overrides: Partial<InstrumentMaster> = {}): InstrumentMaster {
  return {
    symbol: "RELIANCE",
    exchange: "NSE",
    segment: "equity",
    instrumentType: "equity",
    tickSize: 0.05,
    lotSize: null,
    isEligible: true,
    eligibilitySource: "sample",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
    dataLabel: "Sample data",
    ...overrides,
  };
}

function candle(overrides: Partial<Candle> = {}): Candle {
  return {
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    openTime: "2026-10-10T00:00:00.000Z",
    closeTime: "2026-10-10T10:00:00.000Z",
    sourceTimestamp: "2026-10-10T10:00:00.000Z",
    freshnessStatus: "sample",
    qualityFlags: ["sample"],
    complete: true,
    ...overrides,
  };
}

describe("screener", () => {
  const now = new Date("2026-10-11T12:00:00.000Z");
  const flags = defaultIndicatorFlags();

  it("keeps sample rows even when the timestamp is old, and labels them as sample data", () => {
    const screen = runScreener({
      instruments: [instrument()],
      candlesBySymbol: { RELIANCE: [candle({ sourceTimestamp: "2020-01-01T00:00:00.000Z" })] },
      filters: [],
      flags,
      now,
      maxAgeMs: 1000,
    });
    expect(screen.results).toHaveLength(1);
    expect(screen.results[0]).toMatchObject({ dataLabel: "Sample data", live: false });
  });

  it("skips ineligible, stale, malformed, and old non-sample candles", () => {
    const screen = runScreener({
      instruments: [
        instrument({ symbol: "OLD", isEligible: false }),
        instrument({ symbol: "STALE" }),
        instrument({ symbol: "BAD" }),
        instrument({ symbol: "AGED" }),
      ],
      candlesBySymbol: {
        STALE: [candle({ freshnessStatus: "stale" })],
        BAD: [candle({ high: 1, low: 5, open: 3, close: 3 })],
        AGED: [candle({ freshnessStatus: "fresh" as Candle["freshnessStatus"], sourceTimestamp: "2020-01-01T00:00:00.000Z" })],
      },
      filters: [],
      flags,
      now,
      maxAgeMs: 1000,
    });
    expect(screen.results).toHaveLength(0);
    expect(screen.skipped.map((row) => row.reason)).toEqual([
      "Not in the active universe.",
      "Candle is stale or unavailable.",
      "Malformed OHLC.",
      "Candle is older than the freshness limit.",
    ]);
  });

  it("requires every filter to match and rejects a disabled indicator", () => {
    const candles = [candle(), candle({ open: 110, close: 112, high: 113, low: 109 })];
    const passed = runScreener({
      instruments: [instrument()],
      candlesBySymbol: { RELIANCE: candles },
      filters: [],
      flags,
      now,
      maxAgeMs: 1000,
    });
    expect(passed.results).toHaveLength(1);
    const blocked = runScreener({
      instruments: [instrument()],
      candlesBySymbol: { RELIANCE: candles },
      filters: [
        { indicator: "rsi", operator: "gt", value: 101 },
        { indicator: "ema", operator: "above" },
      ],
      flags,
      now,
      maxAgeMs: 1000,
      periods: { rsi: 1, ema: 1 },
    });
    expect(blocked.results).toHaveLength(0);
    expect(() =>
      runScreener({
        instruments: [instrument()],
        candlesBySymbol: { RELIANCE: candles },
        filters: [{ indicator: "atr", operator: "gt", value: 1 }],
        flags,
        now,
        maxAgeMs: 1000,
      }),
    ).toThrow(AppError);
  });

  it("rejects an unknown EMA filter value", () => {
    expect(() => filtersFromSearchParams(new URLSearchParams("ema=sideways"))).toThrow(AppError);
  });
});

describe("pulse and insights", () => {
  it("drops missing pulse inputs and returns null when every input is missing", () => {
    const empty = pulseScore({ rsi: null, close: null, ema: null, cprTop: null, cprBottom: null });
    expect(empty.score).toBeNull();
    expect(empty.renormalized).toBe(false);
    const partial = pulseScore({ rsi: 80, close: null, ema: null, cprTop: null, cprBottom: null });
    expect(partial.score).toBe(80);
    expect(partial.renormalized).toBe(true);
    expect(partial.missing).toEqual(["emaDistance", "cprPosition"]);
    expect(partial.version).toBe("pulse-v1");
  });

  it("keeps unresolved and cancelled tips out of the win-rate denominator", () => {
    const now = new Date("2026-10-11T12:00:00.000Z");
    const tips: InsightTip[] = [
      { id: "win", symbol: "AAA", status: "closed", closeReason: "target_hit", publishedAt: "2026-10-10T10:00:00.000Z", accessTier: "free" },
      { id: "loss", symbol: "BBB", status: "closed", closeReason: "stop_loss_hit", publishedAt: "2026-10-10T11:00:00.000Z", accessTier: "free" },
      { id: "open", symbol: "CCC", status: "published", closeReason: null, publishedAt: "2026-10-10T12:00:00.000Z", accessTier: "premium" },
      { id: "cancel", symbol: "DDD", status: "cancelled", closeReason: null, publishedAt: "2026-10-10T13:00:00.000Z", accessTier: "free" },
      { id: "old", symbol: "EEE", status: "closed", closeReason: "target_hit", publishedAt: "2020-01-01T00:00:00.000Z", accessTier: "free" },
      { id: "draft", symbol: "FFF", status: "draft", closeReason: null, publishedAt: null, accessTier: "free" },
    ];
    const report = buildInsightReport(tips, now, 30);
    expect(report.wins).toBe(1);
    expect(report.losses).toBe(1);
    expect(report.unresolved).toBe(1);
    expect(report.cancelled).toBe(1);
    expect(report.winRate).toBe(50);
    expect(report.rows.map((row) => row.id)).not.toContain("old");
    expect(report.rows.map((row) => row.id)).not.toContain("draft");
    const unresolvedOnly = buildInsightReport(
      [{ id: "open", symbol: "CCC", status: "published", closeReason: null, publishedAt: "2026-10-10T12:00:00.000Z", accessTier: "free" }],
      now,
      30,
    );
    expect(unresolvedOnly.winRate).toBeNull();
  });
});

describe("referrals and push", () => {
  it("accepts a code without granting an entitlement while rewards are off", () => {
    const code = referralCodeFor("referrer");
    expect(code).toMatch(/^INX[0-9A-F]{8}$/);
    const decision = evaluateReferral({
      code,
      referrerUid: "referrer",
      referredUid: "member",
      referrerStatus: "active",
      existingReferralForReferred: false,
      conversions: 4,
    });
    expect(decision.ledger).toBeNull();
    expect(decision.qualified).toBe(false);
    expect(decision.conversions).toBe(5);
    const pending = evaluateReferral({
      code,
      referrerUid: "referrer",
      referredUid: "member",
      referrerStatus: "active",
      existingReferralForReferred: false,
      conversions: 4,
      rewardEnabled: true,
      rewardGrantsEntitlement: false,
      threshold: 5,
    });
    expect(pending.ledger?.status).toBe("pending_approval");
    expect(() =>
      evaluateReferral({
        code,
        referrerUid: "member",
        referredUid: "member",
        referrerStatus: "active",
        existingReferralForReferred: false,
        conversions: 0,
      }),
    ).toThrow(AppError);
  });

  it("refuses push without consent and keeps prices out of the payload", () => {
    expect(() => assertPushConsent({ kind: "transactional", consent: { tipPush: false, marketingPush: false }, revoked: false })).toThrow(AppError);
    const payload = safePushPayload({ symbol: "INFY", accessTier: "premium", tipId: "tip_1" });
    expect(payload.body).not.toMatch(/entry|stop|target|rationale|\d/i);
    expect(pushDeliveryPlan({ configured: false, consent: { tipPush: true, marketingPush: false }, revoked: false, kind: "transactional" }).status).toBe(
      "skipped_unconfigured",
    );
    expect(pushDeliveryPlan({ configured: true, consent: { tipPush: false, marketingPush: false }, revoked: false, kind: "transactional" }).status).toBe(
      "skipped_no_consent",
    );
  });
});

describe("payments", () => {
  it("matches the Razorpay and Cashfree webhook vectors", () => {
    expect(razorpayWebhookSignature("whsec_test", BODY)).toBe("5956e816eee0bb10eed351716e1cfffcf52fd30f9b77a4b168c373896345ac77");
    expect(cashfreeWebhookSignature("cf_secret", "1700000000", BODY)).toBe("/ugfgi96dKkiSjP6Dsb3OG6hQq5dRsuT74rEh4QOrVA=");
    const razorpay = new RazorpayPaymentProvider("rzp_test", "secret", "whsec_test");
    const headers = new Headers({ "x-razorpay-signature": razorpayWebhookSignature("whsec_test", BODY) });
    expect(razorpay.verifyWebhookSignature(BODY, headers)).toBe(true);
    expect(razorpay.verifyWebhookSignature(BODY, new Headers({ "x-razorpay-signature": "00" }))).toBe(false);
    const cashfree = new CashfreePaymentProvider("id", "cf_secret", "cf_secret");
    const cashHeaders = new Headers({
      "x-webhook-timestamp": "1700000000",
      "x-webhook-signature": cashfreeWebhookSignature("cf_secret", "1700000000", BODY),
    });
    expect(cashfree.verifyWebhookSignature(BODY, cashHeaders)).toBe(true);
    const signature = cashHeaders.get("x-webhook-signature") ?? "";
    expect(cashfree.verifyWebhookSignature(BODY, new Headers({ "x-webhook-signature": signature }))).toBe(false);
  });

  it("parses provider amounts in paise and does not call the network for a local test session", async () => {
    const razorpayBody = JSON.stringify({
      event: "payment.captured",
      id: "evt_test_1",
      payload: { payment: { entity: { amount: 9900, currency: "INR", notes: { orderId: "ord_1" } } } },
    });
    expect(parseRazorpayBody(razorpayBody)).toMatchObject({ amountMinor: 9900, currency: "INR", orderId: "ord_1" });
    const cashfreeBody = JSON.stringify({
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: { order: { order_id: "ord_1", order_amount: 99, order_currency: "INR" }, payment: { cf_payment_id: "pay_1" } },
    });
    expect(parseCashfreeBody(cashfreeBody)).toMatchObject({ amountMinor: 9900, currency: "INR", orderId: "ord_1" });

    const calls: string[] = [];
    const original = global.fetch;
    global.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      throw new Error("network");
    }) as typeof fetch;
    const previous = process.env.PAYMENTS_MODE;
    try {
      process.env.PAYMENTS_MODE = "test";
      const provider = new RazorpayPaymentProvider("rzp_test_key", "rzp_test_secret", "whsec_test");
      const session = await provider.createCheckoutSession({ orderId: "ord_1", amountMinor: 9900, currency: "INR", planId: "premium_monthly" });
      expect(session.remote).toBe(false);
      expect(session.session).toBe("test_local_ord_1");
      expect(calls).toEqual([]);
      await expect(new RazorpayPaymentProvider("", "", "").createCheckoutSession({
        orderId: "ord_2",
        amountMinor: 9900,
        currency: "INR",
        planId: "premium_monthly",
      })).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
      process.env.PAYMENTS_MODE = "live";
      await expect(provider.createCheckoutSession({
        orderId: "ord_3",
        amountMinor: 9900,
        currency: "INR",
        planId: "premium_monthly",
      })).rejects.toMatchObject({ status: 503 });
    } finally {
      global.fetch = original;
      if (previous === undefined) delete process.env.PAYMENTS_MODE;
      else process.env.PAYMENTS_MODE = previous;
    }
  });

  it("grants once only for an approved plan, and reports reconciliation exceptions", () => {
    const order = {
      id: "ord_1",
      uid: "user_1",
      planId: "premium_monthly",
      amountMinor: 9900,
      currency: "INR",
      status: "created" as const,
      entitlementGranted: false,
    };
    const event = {
      providerEventId: "evt_1",
      eventType: "payment.captured" as const,
      signatureVerified: true,
      amountMinor: 9900,
      currency: "INR",
    };
    const denied = applyPaymentEvent({ order, event, seenEventIds: new Set(), planApproved: false });
    expect(denied.grantEntitlement).toBe(false);
    expect(denied.order.status).toBe("paid_verified");
    expect(entitlementEffect(denied)).toBe("none");
    const granted = applyPaymentEvent({ order, event, seenEventIds: new Set(), planApproved: true });
    expect(granted.grantEntitlement).toBe(true);
    expect(entitlementEffect(granted)).toBe("grant");
    const duplicate = applyPaymentEvent({
      order: granted.order,
      event,
      seenEventIds: new Set(["evt_1"]),
      planApproved: true,
    });
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.grantEntitlement).toBe(false);
    expect(accessDaysForPlan({ accessDays: 30 })).toBe(30);
    expect(() => accessDaysForPlan({})).toThrow(AppError);

    const report = reconcilePayments(
      [
        { id: "ord_open", amountMinor: 9900, currency: "INR", status: "checkout_pending", createdAt: "2026-10-11T00:00:00.000Z" },
        { id: "ord_paid", amountMinor: 9900, currency: "INR", status: "paid_verified", createdAt: "2026-10-11T00:00:00.000Z" },
      ],
      [
        { providerEventId: "evt_a", orderId: "ord_paid", amountMinor: 100, currency: "INR", signatureVerified: true, eventType: "payment.captured" },
        { providerEventId: "evt_a", orderId: "ord_paid", amountMinor: 100, currency: "INR", signatureVerified: true, eventType: "payment.captured" },
        { providerEventId: "evt_b", orderId: null, amountMinor: null, currency: null, signatureVerified: false, eventType: "payment.captured" },
      ],
      new Date("2026-10-11T12:00:00.000Z"),
    );
    expect(report.unmatchedOrders).toEqual(["ord_open"]);
    expect(report.duplicateEvents).toEqual(["evt_a"]);
    expect(report.amountMismatches).toContain("evt_a");
    expect(report.unverifiedEvents).toEqual(["evt_b"]);
  });

  it("moves subscriptions without dropping access before the period ends", () => {
    expect(nextSubscriptionStatus("checkout_pending", "payment_failed")).toBe("cancelled");
    expect(nextSubscriptionStatus("active", "renewal_failed")).toBe("past_due");
    expect(nextSubscriptionStatus("past_due", "enter_grace")).toBe("grace_period");
    expect(nextSubscriptionStatus("grace_period", "expire")).toBe("expired");
    expect(nextSubscriptionStatus("active", "cancel_at_period_end")).toBe("cancelled_at_period_end");
    expect(nextSubscriptionStatus("active", "payment_failed")).toBeNull();
    expect(cancellationKeepsAccessUntil("2026-11-01T00:00:00.000Z", new Date("2026-10-11T00:00:00.000Z"))).toBe(true);
    expect(cancellationKeepsAccessUntil("2026-10-01T00:00:00.000Z", new Date("2026-10-11T00:00:00.000Z"))).toBe(false);
  });
});

describe("instrument import", () => {
  it("rejects live labels and unlicensed vendor sources", () => {
    expect(() =>
      validateInstrumentImport({
        symbol: "TATA",
        segment: "equity",
        tickSize: 0.05,
        eligibilitySource: "live feed",
        effectiveFrom: "2026-10-11",
      }),
    ).toThrow(AppError);
    expect(() =>
      validateInstrumentImport(
        {
          symbol: "TATA",
          segment: "equity",
          tickSize: 0.05,
          eligibilitySource: "licensed_vendor",
          effectiveFrom: "2026-10-11",
        },
        { licensed: false },
      ),
    ).toThrow(AppError);
    const saved = validateInstrumentImport({
      symbol: "tata",
      segment: "equity",
      tickSize: 0.05,
      eligibilitySource: "manual_unlicensed",
      effectiveFrom: "2026-10-11",
    });
    expect(saved).toMatchObject({ symbol: "TATA", dataLabel: "Sample data" });
  });
});

describe("service worker push boundary", () => {
  it("shows a notification without caching the payload", () => {
    const source = readFileSync("public/sw.js", "utf8");
    const push = source.slice(source.indexOf('addEventListener("push"'), source.indexOf('addEventListener("notificationclick"'));
    expect(push).not.toContain("caches");
    expect(source).toContain('url.pathname.startsWith("/screener")');
    expect(source).toContain('url.pathname.startsWith("/insights")');
  });
});
