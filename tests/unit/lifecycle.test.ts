import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { assertPublishChecklist, canTransition, planTransition } from "@/server/tips/lifecycle";

describe("tip lifecycle", () => {
  it("follows the manual path from draft to a closed outcome", () => {
    expect(canTransition("draft", "submit_review")).toBe(true);
    expect(canTransition("draft", "publish")).toBe(false);
    expect(canTransition("in_review", "publish")).toBe(true);
    expect(canTransition("published", "close")).toBe(true);
    expect(canTransition("closed", "publish")).toBe(false);
    expect(canTransition("cancelled", "expire")).toBe(false);

    const review = planTransition({
      status: "draft",
      action: "submit_review",
      version: 1,
      expectedVersion: 1,
    });
    expect(review.nextStatus).toBe("in_review");
    expect(review.nextVersion).toBe(2);

    const published = planTransition({
      status: "in_review",
      action: "publish",
      reason: "Reviewed",
      version: 2,
      expectedVersion: 2,
    });
    expect(published.nextStatus).toBe("published");
    expect(published.eventType).toBe("published");

    const closed = planTransition({
      status: "published",
      action: "close",
      reason: "Target filled",
      closeReason: "target_hit",
      version: 3,
      expectedVersion: 3,
    });
    expect(closed.nextStatus).toBe("closed");
    expect(closed.closeReason).toBe("target_hit");
  });

  it("rejects a stale version, a missing reason, and a close without an outcome", () => {
    expect(() =>
      planTransition({ status: "draft", action: "cancel", reason: "No", version: 4, expectedVersion: 3 }),
    ).toThrow(AppError);

    expect(() =>
      planTransition({ status: "published", action: "cancel", reason: "x", version: 1, expectedVersion: 1 }),
    ).toThrow(AppError);

    expect(() =>
      planTransition({ status: "published", action: "close", reason: "Done", version: 1, expectedVersion: 1 }),
    ).toThrow(AppError);

    const expired = planTransition({
      status: "published",
      action: "expire",
      reason: "Horizon passed",
      version: 2,
      expectedVersion: 2,
    });
    expect(expired.nextStatus).toBe("expired");
    expect(expired.closeReason).toBeNull();
  });

  it("requires the publish checklist", () => {
    expect(() => assertPublishChecklist(["fields_validated"])).toThrow(AppError);
    expect(() =>
      assertPublishChecklist(["fields_validated", "risk_disclosure_present", "category_rules_checked"]),
    ).not.toThrow();
  });
});
