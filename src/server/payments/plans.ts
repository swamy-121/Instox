import { readFileSync } from "node:fs";
import path from "node:path";
import { AppError } from "@/lib/errors";
import type { PlanConfig } from "@/types/domain";

type PlanFile = {
  termsVersion: string;
  note: string;
  plans: PlanConfig[];
};

let cached: PlanFile | null = null;

export function loadPlans(): PlanFile {
  if (cached) return cached;
  const filePath = process.env.PLANS_CONFIG_PATH
    ? path.resolve(process.env.PLANS_CONFIG_PATH)
    : path.join(process.cwd(), "config", "plans.json");
  cached = JSON.parse(readFileSync(filePath, "utf8")) as PlanFile;
  return cached;
}

export function listActivePlans(now = new Date()): PlanConfig[] {
  const nowIso = now.toISOString();
  return loadPlans().plans.filter((plan) => plan.active && plan.effectiveFrom <= nowIso);
}

export function priceOrder(planId: string, plans = listActivePlans()): {
  plan: PlanConfig;
  amountMinor: number;
  currency: string;
} {
  const plan = plans.find((item) => item.id === planId);
  if (!plan || plan.id === "free") {
    throw new AppError(422, "BUSINESS_RULE_FAILED", "That plan is not available for checkout.");
  }
  return {
    plan,
    amountMinor: plan.priceMinor,
    currency: plan.currency,
  };
}

export function resetPlanCache(): void {
  cached = null;
}
