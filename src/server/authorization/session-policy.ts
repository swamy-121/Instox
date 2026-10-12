import { AppError } from "@/lib/errors";
import type { UserStatus } from "@/types/domain";

const REAUTH_WINDOW_MS = 15 * 60 * 1000;

export function isRecentAuth(authTimeSeconds: number, nowMs: number, windowMs = REAUTH_WINDOW_MS): boolean {
  if (!Number.isFinite(authTimeSeconds)) return false;
  const age = nowMs - authTimeSeconds * 1000;
  return age >= 0 && age <= windowMs;
}

export function assertRecentAuth(authTimeSeconds: number | undefined, nowMs: number): void {
  if (authTimeSeconds === undefined || !isRecentAuth(authTimeSeconds, nowMs)) {
    throw new AppError(
      403,
      "REAUTH_REQUIRED",
      "Sign in again, then retry this action. It needs a recent sign-in.",
    );
  }
}

export function assertAccountActive(status: UserStatus): void {
  if (status === "disabled") {
    throw new AppError(403, "ACCOUNT_DISABLED", "This account is disabled.");
  }
  if (status === "deletion_pending") {
    throw new AppError(403, "ACCOUNT_DISABLED", "This account is scheduled for deletion.");
  }
}
