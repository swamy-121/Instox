import { AppError } from "@/lib/errors";
import type { ScreenerFilter } from "@/server/screener/engine";

function numberParam(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new AppError(400, "VALIDATION_ERROR", "Review the screener filters.", { [key]: "Enter a number." });
  }
  return value;
}

export function filtersFromSearchParams(params: URLSearchParams): ScreenerFilter[] {
  const filters: ScreenerFilter[] = [];
  const rsiGt = numberParam(params, "rsiGt");
  const rsiLt = numberParam(params, "rsiLt");
  const rsiGte = numberParam(params, "rsiGte");
  const rsiLte = numberParam(params, "rsiLte");
  if (rsiGt !== null) filters.push({ indicator: "rsi", operator: "gt", value: rsiGt });
  if (rsiLt !== null) filters.push({ indicator: "rsi", operator: "lt", value: rsiLt });
  if (rsiGte !== null) filters.push({ indicator: "rsi", operator: "gte", value: rsiGte });
  if (rsiLte !== null) filters.push({ indicator: "rsi", operator: "lte", value: rsiLte });

  const ema = params.get("ema");
  if (ema === "above" || ema === "below") filters.push({ indicator: "ema", operator: ema });
  else if (ema) throw new AppError(400, "VALIDATION_ERROR", "Review the screener filters.", { ema: "Use above or below." });

  const cpr = params.get("cpr");
  if (cpr === "above" || cpr === "below" || cpr === "inside") filters.push({ indicator: "cpr", operator: cpr });
  else if (cpr) throw new AppError(400, "VALIDATION_ERROR", "Review the screener filters.", { cpr: "Use above, below, or inside." });

  const atrGt = numberParam(params, "atrGt");
  const atrLt = numberParam(params, "atrLt");
  if (atrGt !== null) filters.push({ indicator: "atr", operator: "gt", value: atrGt });
  if (atrLt !== null) filters.push({ indicator: "atr", operator: "lt", value: atrLt });

  const supertrend = params.get("supertrend");
  if (supertrend === "up" || supertrend === "down") filters.push({ indicator: "supertrend", operator: supertrend });
  else if (supertrend) {
    throw new AppError(400, "VALIDATION_ERROR", "Review the screener filters.", { supertrend: "Use up or down." });
  }

  return filters;
}
