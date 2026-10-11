import { z } from "zod";
import complianceConfig from "../../../config/compliance.json";
import instrumentConfig from "../../../config/instruments.json";
import { AppError } from "@/lib/errors";
import { isTickAligned } from "@/lib/money";
import {
  ACCESS_TIERS,
  TIP_CATEGORIES,
  TIP_SIDES,
  type AccessTier,
  type TipCategory,
  type TipSide,
  type TipTarget,
} from "@/types/domain";

export type InstrumentRef = {
  symbol: string;
  segment: "equity" | "futures" | "options";
  tickSize: number;
  eligible: boolean;
};

export type ComplianceConfig = {
  riskDisclosureVersion: string;
  pennyStockPublishEnabled: boolean;
  consentVersion: string;
  prohibitedClaims: string[];
};

const targetSchema = z.object({
  label: z.enum(["T1", "T2", "T3"]),
  price: z.number({ invalid_type_error: "Enter a price." }).positive("Enter a price above zero."),
});

const rawTipSchema = z.object({
  symbol: z.string().trim().min(1, "Symbol is required.").transform((value) => value.toUpperCase()),
  category: z.enum(TIP_CATEGORIES, { errorMap: () => ({ message: "Choose a category." }) }),
  side: z.enum(TIP_SIDES, { errorMap: () => ({ message: "Choose BUY or SELL." }) }),
  entryMin: z.number({ invalid_type_error: "Entry is required." }).positive("Entry must be above zero."),
  entryMax: z.number().positive("Upper entry must be above zero.").nullable().optional(),
  stopLoss: z.number({ invalid_type_error: "Stop loss is required." }).positive("Stop loss must be above zero."),
  targets: z.array(targetSchema).max(3, "Use at most three targets."),
  optionType: z.enum(["CE", "PE"]).nullable().optional(),
  strikePrice: z.number().positive().nullable().optional(),
  expiry: z.string().trim().nullable().optional(),
  underlying: z.string().trim().nullable().optional(),
  lotSize: z.number().int().positive().nullable().optional(),
  timeframe: z.string().trim().min(2, "Timeframe is required.").max(80, "Timeframe is too long."),
  thesis: z.string().trim().min(20, "Rationale must be at least 20 characters.").max(2000, "Rationale is too long."),
  riskDisclosureVersion: z.string().trim().min(1, "Risk disclosure version is required."),
  accessTier: z.enum(ACCESS_TIERS).optional(),
  expiresAt: z.string().trim().nullable().optional(),
});

export type TipInput = {
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
  expiresAt: string | null;
};

function fieldError(fields: Record<string, string>): never {
  throw new AppError(400, "VALIDATION_ERROR", "Review the highlighted fields.", fields);
}

function segmentFor(category: TipCategory, instrument: InstrumentRef): "equity" | "futures" | "options" {
  if (category === "futures") return "futures";
  if (category === "options") return "options";
  return instrument.segment === "options" || instrument.segment === "futures" ? "equity" : instrument.segment;
}

export function validateTipInput(
  input: unknown,
  options?: {
    instruments?: InstrumentRef[];
    compliance?: ComplianceConfig;
    forPublish?: boolean;
    now?: Date;
  },
): TipInput {
  const parsed = rawTipSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] ? String(issue.path[0]) : "form";
      if (!fields[key]) fields[key] = issue.message;
    }
    fieldError(fields);
  }

  const data = parsed.data;
  const instruments = options?.instruments ?? (instrumentConfig.instruments as InstrumentRef[]);
  const compliance = options?.compliance ?? (complianceConfig as ComplianceConfig);
  const fields: Record<string, string> = {};
  const instrument = instruments.find((item) => item.symbol === data.symbol && item.eligible);

  if (!instrument) {
    fields.symbol = "Symbol is not on the approved sample list.";
  }

  const entryMax = data.entryMax ?? null;
  if (entryMax !== null && entryMax < data.entryMin) {
    fields.entryMax = "Upper entry must be greater than or equal to the lower entry.";
  }

  const entryCeiling = entryMax ?? data.entryMin;
  if (data.side === "BUY" && data.stopLoss >= data.entryMin) {
    fields.stopLoss = "For a buy, the stop loss must be below the entry.";
  }
  if (data.side === "SELL" && data.stopLoss <= entryCeiling) {
    fields.stopLoss = "For a sell, the stop loss must be above the entry.";
  }

  const labels = data.targets.map((target) => target.label);
  if (new Set(labels).size !== labels.length) {
    fields.targets = "Target labels must be unique.";
  }
  const expected = ["T1", "T2", "T3"].slice(0, data.targets.length);
  if (labels.join(",") !== expected.join(",")) {
    fields.targets = "Targets must be ordered T1, T2, then T3 with no gaps.";
  }
  for (let index = 0; index < data.targets.length; index += 1) {
    const target = data.targets[index];
    if (!target) continue;
    if (data.side === "BUY" && target.price <= entryCeiling) {
      fields.targets = "Buy targets must sit above the entry.";
    }
    if (data.side === "SELL" && target.price >= data.entryMin) {
      fields.targets = "Sell targets must sit below the entry.";
    }
    if (index > 0) {
      const previous = data.targets[index - 1];
      if (previous && data.side === "BUY" && target.price <= previous.price) {
        fields.targets = "Buy targets must increase from T1 to T3.";
      }
      if (previous && data.side === "SELL" && target.price >= previous.price) {
        fields.targets = "Sell targets must decrease from T1 to T3.";
      }
    }
  }

  if (instrument) {
    const prices = [data.entryMin, entryMax, data.stopLoss, ...data.targets.map((target) => target.price)].filter(
      (price): price is number => typeof price === "number",
    );
    if (prices.some((price) => !isTickAligned(price, instrument.tickSize))) {
      fields.entryMin = fields.entryMin ?? `Prices must follow the ${instrument.tickSize} tick size.`;
    }
  }

  const thesisLower = data.thesis.toLowerCase();
  const banned = compliance.prohibitedClaims.find((phrase) => thesisLower.includes(phrase));
  if (banned) {
    fields.thesis = "Remove language that promises or guarantees a result.";
  }

  if (data.riskDisclosureVersion !== compliance.riskDisclosureVersion) {
    fields.riskDisclosureVersion = "Use the current risk disclosure version.";
  }

  const category = data.category;
  const expiry = data.expiry?.trim() || null;
  const optionType = data.optionType ?? null;
  const strikePrice = data.strikePrice ?? null;
  const underlying = data.underlying?.trim().toUpperCase() || null;
  const lotSize = data.lotSize ?? null;

  if (category === "futures" || category === "options") {
    if (!expiry || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
      fields.expiry = "Enter an expiry date as YYYY-MM-DD.";
    }
  }
  if (category === "options") {
    if (!optionType) fields.optionType = "Choose CE or PE.";
    if (!strikePrice) fields.strikePrice = "Strike is required for options.";
    if (!underlying) fields.underlying = "Underlying is required for options.";
    if (!lotSize) fields.lotSize = "Lot size is required for options.";
    if (underlying && !instruments.some((item) => item.symbol === underlying && item.eligible)) {
      fields.underlying = "Underlying is not on the sample list.";
    }
  }

  let accessTier: AccessTier = data.accessTier ?? "free";
  if (category === "penny_stocks") {
    accessTier = "premium";
  }

  if (options?.forPublish && category === "penny_stocks" && !compliance.pennyStockPublishEnabled) {
    fields.category = "Penny-stock tips stay unpublished until compliance review allows them.";
  }

  if (options?.forPublish && expiry && (category === "futures" || category === "options")) {
    const today = (options.now ?? new Date()).toISOString().slice(0, 10);
    if (expiry < today) {
      fields.expiry = "Expiry is already in the past.";
    }
  }

  if (Object.keys(fields).length > 0) fieldError(fields);

  return {
    symbol: data.symbol,
    instrumentId: data.symbol,
    segment: segmentFor(category, instrument ?? { symbol: data.symbol, segment: "equity", tickSize: 0.05, eligible: true }),
    category,
    side: data.side,
    entryMin: data.entryMin,
    entryMax,
    stopLoss: data.stopLoss,
    targets: data.targets,
    optionType: category === "options" ? optionType : null,
    strikePrice: category === "options" ? strikePrice : null,
    expiry: category === "futures" || category === "options" ? expiry : null,
    underlying: category === "options" ? underlying : null,
    lotSize: category === "options" ? lotSize : null,
    timeframe: data.timeframe,
    thesis: data.thesis,
    riskDisclosureVersion: data.riskDisclosureVersion,
    accessTier,
    expiresAt: data.expiresAt?.trim() || null,
  };
}

export function defaultTipAccessTier(category: TipCategory, requested?: AccessTier): AccessTier {
  if (category === "penny_stocks") return "premium";
  return requested ?? "free";
}
