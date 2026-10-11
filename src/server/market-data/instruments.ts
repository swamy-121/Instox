import instrumentFile from "../../../config/instruments.json";
import { AppError } from "@/lib/errors";

export type InstrumentMaster = {
  symbol: string;
  exchange: "NSE";
  segment: "equity" | "futures" | "options";
  instrumentType: "equity" | "futures" | "options";
  tickSize: number;
  lotSize: number | null;
  isEligible: boolean;
  eligibilitySource: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  dataLabel: "Sample data";
};

const LICENSED_SOURCES = new Set(["licensed_vendor"]);

function asSegment(value: string): InstrumentMaster["segment"] {
  if (value === "futures" || value === "options") return value;
  return "equity";
}

export function sampleInstruments(): InstrumentMaster[] {
  return instrumentFile.instruments.map((item) => ({
    symbol: item.symbol,
    exchange: "NSE" as const,
    segment: asSegment(item.segment),
    instrumentType: asSegment(item.segment),
    tickSize: item.tickSize,
    lotSize: item.segment === "options" ? 15 : null,
    isEligible: item.eligible,
    eligibilitySource: "sample",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
    dataLabel: "Sample data" as const,
  }));
}

export function isInstrumentActive(instrument: InstrumentMaster, now: Date): boolean {
  if (!instrument.isEligible) return false;
  const from = Date.parse(instrument.effectiveFrom);
  const to = instrument.effectiveTo ? Date.parse(instrument.effectiveTo) : Number.POSITIVE_INFINITY;
  const time = now.getTime();
  return Number.isFinite(from) && time >= from && time < to;
}

export function validateInstrumentImport(
  input: unknown,
  options?: { licensed?: boolean },
): InstrumentMaster {
  if (!input || typeof input !== "object") {
    throw new AppError(400, "VALIDATION_ERROR", "Instrument details are required.");
  }
  const body = input as Record<string, unknown>;
  const symbol = String(body.symbol ?? "").trim().toUpperCase();
  const segment = body.segment;
  const tickSize = Number(body.tickSize);
  const effectiveFrom = String(body.effectiveFrom ?? "");
  const source = String(body.eligibilitySource ?? "").trim();
  const fields: Record<string, string> = {};
  if (!/^[A-Z][A-Z0-9&-]{0,20}$/.test(symbol)) fields.symbol = "Use an uppercase symbol.";
  if (segment !== "equity" && segment !== "futures" && segment !== "options") {
    fields.segment = "Segment must be equity, futures, or options.";
  }
  if (!Number.isFinite(tickSize) || tickSize <= 0) fields.tickSize = "Tick size must be above zero.";
  if (!/^\d{4}-\d{2}-\d{2}/.test(effectiveFrom) || Number.isNaN(Date.parse(effectiveFrom))) {
    fields.effectiveFrom = "Effective from must be a date.";
  }
  if (!source) fields.eligibilitySource = "Name the source of this row.";
  const licensed = options?.licensed === true;
  if (!licensed && LICENSED_SOURCES.has(source)) {
    fields.eligibilitySource = "A licensed source cannot be saved until MARKET_DATA_LICENSED is set.";
  }
  if (/live|real-time|realtime/i.test(source)) {
    fields.eligibilitySource = "Do not label this list as live.";
  }
  if (Object.keys(fields).length > 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Review the instrument fields.", fields);
  }
  return {
    symbol,
    exchange: "NSE",
    segment: segment as InstrumentMaster["segment"],
    instrumentType: segment as InstrumentMaster["instrumentType"],
    tickSize,
    lotSize: body.lotSize == null || body.lotSize === "" ? null : Number(body.lotSize),
    isEligible: body.isEligible !== false,
    eligibilitySource: licensed ? source : source || "manual_unlicensed",
    effectiveFrom: new Date(effectiveFrom).toISOString(),
    effectiveTo: body.effectiveTo ? new Date(String(body.effectiveTo)).toISOString() : null,
    dataLabel: "Sample data",
  };
}
