import { AppError } from "@/lib/errors";

/** Access length comes from plan config. A missing window is not filled in with a default. */
export function accessDaysForPlan(plan: { accessDays?: number } | undefined): number {
  const days = plan?.accessDays;
  if (!Number.isInteger(days) || days === undefined || days < 1 || days > 366) {
    throw new AppError(422, "BUSINESS_RULE_FAILED", "This plan has no configured access window.");
  }
  return days;
}
