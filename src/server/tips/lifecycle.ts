import { AppError } from "@/lib/errors";
import type { CloseReason, TipEventType, TipStatus, TransitionAction } from "@/types/domain";

const TRANSITIONS: Record<TipStatus, Partial<Record<TransitionAction, TipStatus>>> = {
  draft: {
    submit_review: "in_review",
    cancel: "cancelled",
  },
  in_review: {
    return_to_draft: "draft",
    publish: "published",
    cancel: "cancelled",
  },
  published: {
    close: "closed",
    cancel: "cancelled",
    expire: "expired",
  },
  closed: {},
  cancelled: {},
  expired: {},
};

const EVENT_TYPES: Record<TransitionAction, TipEventType> = {
  submit_review: "submitted_for_review",
  return_to_draft: "returned_to_draft",
  publish: "published",
  close: "closed",
  cancel: "cancelled",
  expire: "expired",
};

const REASON_REQUIRED = new Set<TransitionAction>([
  "return_to_draft",
  "publish",
  "close",
  "cancel",
  "expire",
]);

export type TransitionInput = {
  status: TipStatus;
  action: TransitionAction;
  reason?: string;
  closeReason?: CloseReason | null;
  version: number;
  expectedVersion: number;
};

export type TransitionResult = {
  nextStatus: TipStatus;
  eventType: TipEventType;
  closeReason: CloseReason | null;
  nextVersion: number;
  reason: string;
};

export function canTransition(status: TipStatus, action: TransitionAction): boolean {
  return Boolean(TRANSITIONS[status][action]);
}

export function assertExpectedVersion(current: number, expected: number): void {
  if (!Number.isInteger(expected) || current !== expected) {
    throw new AppError(
      409,
      "STATE_CONFLICT",
      "This tip was updated by someone else. Reload it and try again.",
    );
  }
}

export function planTransition(input: TransitionInput): TransitionResult {
  assertExpectedVersion(input.version, input.expectedVersion);
  const nextStatus = TRANSITIONS[input.status][input.action];
  if (!nextStatus) {
    throw new AppError(
      409,
      "STATE_CONFLICT",
      `Cannot ${input.action.replaceAll("_", " ")} a tip that is ${input.status.replaceAll("_", " ")}.`,
    );
  }

  const reason = (input.reason ?? "").trim();
  if (REASON_REQUIRED.has(input.action) && reason.length < 3) {
    throw new AppError(400, "VALIDATION_ERROR", "A reason is required.", {
      reason: "Enter a short reason (at least 3 characters).",
    });
  }

  let closeReason: CloseReason | null = null;
  if (input.action === "close") {
    if (!input.closeReason) {
      throw new AppError(400, "VALIDATION_ERROR", "Choose how this tip closed.", {
        closeReason: "Select a close reason.",
      });
    }
    closeReason = input.closeReason;
  }

  return {
    nextStatus,
    eventType: EVENT_TYPES[input.action],
    closeReason,
    nextVersion: input.version + 1,
    reason: reason || "Submitted for review",
  };
}

export const PUBLISH_CHECKLIST = [
  "fields_validated",
  "risk_disclosure_present",
  "category_rules_checked",
] as const;

export function assertPublishChecklist(checklist: readonly string[]): void {
  const missing = PUBLISH_CHECKLIST.filter((item) => !checklist.includes(item));
  if (missing.length > 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Complete the review checklist before publishing.", {
      reviewChecklist: `Missing: ${missing.join(", ")}`,
    });
  }
}
