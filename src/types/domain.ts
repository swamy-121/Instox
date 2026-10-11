export const ROLES = [
  "member",
  "editor",
  "publisher",
  "support",
  "admin",
  "super_admin",
] as const;

export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ["active", "disabled", "deletion_pending"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const TIP_STATUSES = [
  "draft",
  "in_review",
  "published",
  "closed",
  "cancelled",
  "expired",
] as const;
export type TipStatus = (typeof TIP_STATUSES)[number];

export const TIP_CATEGORIES = [
  "equity",
  "futures",
  "options",
  "penny_stocks",
  "intraday",
  "btst",
  "short_term",
  "long_term",
] as const;
export type TipCategory = (typeof TIP_CATEGORIES)[number];

export const TIP_SIDES = ["BUY", "SELL"] as const;
export type TipSide = (typeof TIP_SIDES)[number];

export const ACCESS_TIERS = ["free", "premium"] as const;
export type AccessTier = (typeof ACCESS_TIERS)[number];

export const CLOSE_REASONS = [
  "target_hit",
  "stop_loss_hit",
  "time_expired",
  "manually_closed",
] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

export const TRANSITION_ACTIONS = [
  "submit_review",
  "return_to_draft",
  "publish",
  "close",
  "cancel",
  "expire",
] as const;
export type TransitionAction = (typeof TRANSITION_ACTIONS)[number];

export const ENTITLEMENT_STATUSES = ["active", "grace", "expired", "revoked"] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

export type TargetLabel = "T1" | "T2" | "T3";

export type TipTarget = {
  label: TargetLabel;
  price: number;
};

export type TipRecord = {
  id: string;
  symbol: string;
  instrumentId: string;
  segment: "equity" | "futures" | "options";
  category: TipCategory;
  side: TipSide;
  entryMin: number;
  entryMax: number | null;
  stopLoss: number;
  targets: TipTarget[];
  optionType: "CE" | "PE" | null;
  strikePrice: number | null;
  expiry: string | null;
  underlying: string | null;
  lotSize: number | null;
  timeframe: string;
  thesis: string;
  riskDisclosureVersion: string;
  accessTier: AccessTier;
  status: TipStatus;
  closeReason: CloseReason | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  version: number;
};

export type TipEventType =
  | "draft_created"
  | "content_updated"
  | "content_corrected"
  | "submitted_for_review"
  | "returned_to_draft"
  | "published"
  | "closed"
  | "cancelled"
  | "expired";

export type TipEvent = {
  id: string;
  tipId: string;
  eventType: TipEventType;
  oldStatus: TipStatus | null;
  newStatus: TipStatus | null;
  oldVersion: number | null;
  newVersion: number | null;
  reason: string;
  actorUid: string;
  occurredAt: string;
  requestId: string;
  previous: Partial<TipRecord> | null;
};

export type UserProfile = {
  uid: string;
  displayName: string;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  status: UserStatus;
  locale: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  consentVersion: string | null;
  consentAt: string | null;
  providers: string[];
};

export type RoleRecord = {
  uid: string;
  roles: Role[];
  grantedBy: string;
  grantedAt: string;
  updatedAt: string;
};

export type EntitlementRecord = {
  uid: string;
  planId: string;
  status: EntitlementStatus;
  startsAt: string;
  endsAt: string;
  sourceOrderId: string | null;
  source: string;
  updatedAt: string;
  version: number;
};

export type ResolvedEntitlement = {
  tier: AccessTier;
  planId: string | null;
  status: EntitlementStatus | "none";
  startsAt: string | null;
  endsAt: string | null;
};

export type PlanConfig = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  billingPeriod: string;
  features: string[];
  active: boolean;
  approved: boolean;
  effectiveFrom: string;
  taxTreatment: string;
  placeholder: boolean;
  accessDays?: number;
};

export type PaymentOrderStatus =
  | "created"
  | "checkout_pending"
  | "paid_verified"
  | "failed"
  | "refunded"
  | "disputed";

export type PaymentOrder = {
  id: string;
  uid: string;
  planId: string;
  provider: string;
  providerOrderId: string | null;
  amountMinor: number;
  currency: string;
  status: PaymentOrderStatus;
  idempotencyKey: string;
  createdAt: string;
  expiresAt: string | null;
  verifiedAt: string | null;
  failureCode: string | null;
  placeholder: boolean;
};
