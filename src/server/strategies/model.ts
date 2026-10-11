import { AppError } from "@/lib/errors";

export type StrategyIndicator = "rsi" | "ema" | "cpr";

export type StrategyRule = {
  indicator: StrategyIndicator;
  operator: "gt" | "lt" | "above" | "below" | "inside";
  value?: number;
};

export type StrategyDraft = {
  name: string;
  rules: StrategyRule[];
  version: number;
  status: "draft";
};

const OPERATORS: Record<StrategyIndicator, ReadonlySet<string>> = {
  rsi: new Set(["gt", "lt"]),
  ema: new Set(["above", "below"]),
  cpr: new Set(["above", "below", "inside"]),
};

export function assertStrategyDoesNotPublish(input: { status?: unknown; publish?: unknown }): void {
  if (input.publish === true || input.status === "published" || input.status === "publish") {
    throw new AppError(422, "BUSINESS_RULE_FAILED", "A strategy cannot publish a tip.");
  }
}

export function validateStrategy(input: { name?: unknown; rules?: unknown }, version: number): StrategyDraft {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    throw new AppError(400, "VALIDATION_ERROR", "Name the strategy.", { name: "Use 2 to 80 characters." });
  }
  if (!Array.isArray(input.rules) || input.rules.length < 1 || input.rules.length > 8) {
    throw new AppError(400, "VALIDATION_ERROR", "Add between 1 and 8 rules.", { rules: "Add at least one rule." });
  }
  const rules: StrategyRule[] = input.rules.map((rule) => {
    if (!rule || typeof rule !== "object") {
      throw new AppError(400, "VALIDATION_ERROR", "Each rule needs an indicator and an operator.", { rules: "Check the rules." });
    }
    const record = rule as Record<string, unknown>;
    const indicator = record.indicator;
    const operator = record.operator;
    if (indicator !== "rsi" && indicator !== "ema" && indicator !== "cpr") {
      throw new AppError(400, "VALIDATION_ERROR", "Rules can use RSI, EMA, or CPR.", { rules: "Unknown indicator." });
    }
    if (typeof operator !== "string" || !OPERATORS[indicator].has(operator)) {
      throw new AppError(400, "VALIDATION_ERROR", "That operator does not fit the indicator.", { rules: "Check the operator." });
    }
    const value = record.value;
    if (indicator === "rsi") {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
        throw new AppError(400, "VALIDATION_ERROR", "RSI rules need a value from 0 to 100.", { rules: "Enter an RSI value." });
      }
      return { indicator, operator: operator as "gt" | "lt", value };
    }
    return { indicator, operator: operator as StrategyRule["operator"] };
  });
  return { name, rules, version, status: "draft" };
}

export function nextStrategyVersion(current: number): number {
  if (!Number.isInteger(current) || current < 1) return 1;
  return current + 1;
}
