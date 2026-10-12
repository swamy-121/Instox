import type { AccessTier, TipRecord } from "@/types/domain";

const LOCKED_FIELDS = [
  "id",
  "symbol",
  "category",
  "side",
  "status",
  "accessTier",
  "timeframe",
  "publishedAt",
  "updatedAt",
  "locked",
] as const;

export type LockedTipView = {
  id: string;
  symbol: string;
  category: TipRecord["category"];
  side: TipRecord["side"];
  status: TipRecord["status"];
  accessTier: "premium";
  timeframe: string;
  publishedAt: string | null;
  updatedAt: string;
  locked: true;
};

export type OpenTipView = {
  id: string;
  symbol: string;
  instrumentId: string;
  segment: TipRecord["segment"];
  category: TipRecord["category"];
  side: TipRecord["side"];
  status: TipRecord["status"];
  accessTier: AccessTier;
  timeframe: string;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
  entryMin: number;
  entryMax: number | null;
  stopLoss: number;
  targets: TipRecord["targets"];
  optionType: TipRecord["optionType"];
  strikePrice: number | null;
  expiry: string | null;
  underlying: string | null;
  lotSize: number | null;
  thesis: string;
  riskDisclosureVersion: string;
  closeReason: TipRecord["closeReason"];
  expiresAt: string | null;
  version: number;
  locked: false;
};

export type TipView = LockedTipView | OpenTipView;

export function isPremiumLocked(tip: Pick<TipRecord, "accessTier">, viewerTier: AccessTier): boolean {
  return tip.accessTier === "premium" && viewerTier !== "premium";
}

export function presentTip(tip: TipRecord, viewerTier: AccessTier): TipView {
  if (isPremiumLocked(tip, viewerTier)) {
    const locked: LockedTipView = {
      id: tip.id,
      symbol: tip.symbol,
      category: tip.category,
      side: tip.side,
      status: tip.status,
      accessTier: "premium",
      timeframe: tip.timeframe,
      publishedAt: tip.publishedAt,
      updatedAt: tip.updatedAt,
      locked: true,
    };
    return locked;
  }

  return {
    id: tip.id,
    symbol: tip.symbol,
    instrumentId: tip.instrumentId,
    segment: tip.segment,
    category: tip.category,
    side: tip.side,
    status: tip.status,
    accessTier: tip.accessTier,
    timeframe: tip.timeframe,
    publishedAt: tip.publishedAt,
    updatedAt: tip.updatedAt,
    createdAt: tip.createdAt,
    entryMin: tip.entryMin,
    entryMax: tip.entryMax,
    stopLoss: tip.stopLoss,
    targets: tip.targets,
    optionType: tip.optionType,
    strikePrice: tip.strikePrice,
    expiry: tip.expiry,
    underlying: tip.underlying,
    lotSize: tip.lotSize,
    thesis: tip.thesis,
    riskDisclosureVersion: tip.riskDisclosureVersion,
    closeReason: tip.closeReason,
    expiresAt: tip.expiresAt,
    version: tip.version,
    locked: false,
  };
}

export function lockedFieldNames(): readonly string[] {
  return LOCKED_FIELDS;
}
