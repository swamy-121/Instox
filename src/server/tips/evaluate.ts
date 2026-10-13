import type { CloseReason, TipSide } from "@/types/domain";

const IST_OFFSET_MINUTES = 330;

export type DailyBar = {
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type EvalTip = {
  side: TipSide;
  stopLoss: number;
  targets: Array<{ label: string; price: number }>;
  publishedAt: string | null;
  expiresAt: string | null;
  status: string;
};

export type EvalDecision = {
  action: "hold" | "close" | "expire";
  closeReason: Extract<CloseReason, "target_hit" | "stop_loss_hit"> | null;
  targetLabel: string | null;
  reason: string;
};

export type AlertPrefs = {
  targetHit: boolean;
  stopLoss: boolean;
  expired: boolean;
};

/**
 * A published idea against one daily bar.
 * Buy: the high reaches a target, the low reaches the stop.
 * Sell: the low reaches a target, the high reaches the stop.
 * If one bar touches both, the level nearer the open is counted first.
 * A tie counts as the stop, so a win is not assumed.
 * On the expiry date a miss becomes expired. A hit that day still counts.
 */
export function evaluateTipBar(tip: EvalTip, bar: DailyBar): EvalDecision {
  if (tip.status !== "published") {
    return hold("Only an open idea is checked.");
  }
  if (!tip.publishedAt) return hold("This idea has no publish date.");
  if (!usableBar(bar)) return hold("This price bar cannot be used.");

  const publishedDay = istDay(tip.publishedAt);
  if (!publishedDay) return hold("This idea has no publish date.");
  if (bar.tradeDate < publishedDay) return hold("This bar is from before the idea was published.");

  const expiryDay = tip.expiresAt ? istDay(tip.expiresAt) : null;
  if (expiryDay && bar.tradeDate > expiryDay) {
    return {
      action: "expire",
      closeReason: null,
      targetLabel: null,
      reason: "The window ended before this bar, with no target or stop.",
    };
  }

  const targets = orderedTargets(tip);
  const reached = targets.filter((target) => touchedTarget(tip.side, bar, target.price));
  const stopHit = touchedStop(tip.side, bar, tip.stopLoss);
  const nearest = reached[0] ?? null;
  const furthest = reached.length > 0 ? reached[reached.length - 1] : null;

  if (nearest && stopHit) {
    const targetDistance = Math.abs(bar.open - nearest.price);
    const stopDistance = Math.abs(bar.open - tip.stopLoss);
    if (stopDistance <= targetDistance) {
      return {
        action: "close",
        closeReason: "stop_loss_hit",
        targetLabel: null,
        reason: "The bar touched the stop and a target. The stop is nearer the open, so it counts as the stop.",
      };
    }
    return {
      action: "close",
      closeReason: "target_hit",
      targetLabel: nearest.label,
      reason: `The bar touched ${nearest.label} nearer the open than the stop.`,
    };
  }

  if (furthest) {
    return {
      action: "close",
      closeReason: "target_hit",
      targetLabel: furthest.label,
      reason: `Price reached ${furthest.label}.`,
    };
  }
  if (stopHit) {
    return {
      action: "close",
      closeReason: "stop_loss_hit",
      targetLabel: null,
      reason: "Price reached the stop.",
    };
  }
  if (expiryDay && bar.tradeDate >= expiryDay) {
    return {
      action: "expire",
      closeReason: null,
      targetLabel: null,
      reason: "The window ended without a target or a stop.",
    };
  }
  return hold("Still open. Neither the target nor the stop was touched.");
}

export function evaluateTipSeries(tip: EvalTip, bars: DailyBar[], today: string): EvalDecision {
  if (tip.status !== "published") return hold("Only an open idea is checked.");
  const publishedDay = tip.publishedAt ? istDay(tip.publishedAt) : "";
  if (!publishedDay) return hold("This idea has no publish date.");
  const ordered = bars
    .filter((bar) => bar.tradeDate >= publishedDay && bar.tradeDate <= today)
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  for (const bar of ordered) {
    const decision = evaluateTipBar(tip, bar);
    if (decision.action !== "hold") return decision;
  }
  const expiryDay = tip.expiresAt ? istDay(tip.expiresAt) : null;
  if (expiryDay && today > expiryDay) {
    return {
      action: "expire",
      closeReason: null,
      targetLabel: null,
      reason: "The window ended without a target or a stop.",
    };
  }
  return hold("Still open. Neither the target nor the stop was touched.");
}

export function istDay(instant: string | Date): string {
  if (typeof instant === "string" && /^\d{4}-\d{2}-\d{2}$/.test(instant)) return instant;
  const time = typeof instant === "string" ? Date.parse(instant) : instant.getTime();
  if (!Number.isFinite(time)) return "";
  const shifted = new Date(time + IST_OFFSET_MINUTES * 60 * 1000);
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${month}-${day}`;
}

export function flatBar(last: number, tradeDate: string): DailyBar {
  return { tradeDate, open: last, high: last, low: last, close: last };
}

export function priceIsNearEntry(entry: number, price: number): boolean {
  if (!(entry > 0) || !(price > 0)) return false;
  const ratio = price / entry;
  return ratio >= 0.5 && ratio <= 2;
}

export function barsForEvaluation(input: {
  entry: number;
  stored: DailyBar[];
  last: number | null;
  today: string;
}): { bars: DailyBar[]; source: "bhavcopy" | "last" | "none" } {
  const stored = input.stored.filter((bar) => priceIsNearEntry(input.entry, bar.close) && usableBar(bar));
  if (stored.length > 0) return { bars: stored, source: "bhavcopy" };
  if (input.last !== null && priceIsNearEntry(input.entry, input.last)) {
    return { bars: [flatBar(input.last, input.today)], source: "last" };
  }
  return { bars: [], source: "none" };
}

export function wantsResultAlert(prefs: AlertPrefs, decision: EvalDecision): boolean {
  if (decision.action === "close" && decision.closeReason === "target_hit") return prefs.targetHit;
  if (decision.action === "close" && decision.closeReason === "stop_loss_hit") return prefs.stopLoss;
  if (decision.action === "expire") return prefs.expired;
  return false;
}

export function resultNote(symbol: string, decision: EvalDecision): { title: string; body: string } | null {
  if (decision.action === "close" && decision.closeReason === "target_hit") {
    const which = decision.targetLabel ? ` ${decision.targetLabel}` : " a target";
    return {
      title: `${symbol} reached${which}`,
      body: `${symbol} touched${which}. This is a result note, not a new idea.`,
    };
  }
  if (decision.action === "close" && decision.closeReason === "stop_loss_hit") {
    return {
      title: `${symbol} hit its stop`,
      body: `${symbol} reached the stop. This is a result note, not a new idea.`,
    };
  }
  if (decision.action === "expire") {
    return {
      title: `${symbol} window ended`,
      body: `The window for ${symbol} ended without a target or a stop.`,
    };
  }
  return null;
}

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  targetHit: true,
  stopLoss: true,
  expired: false,
};

function hold(reason: string): EvalDecision {
  return { action: "hold", closeReason: null, targetLabel: null, reason };
}

function usableBar(bar: DailyBar): boolean {
  const values = [bar.open, bar.high, bar.low, bar.close];
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(bar.tradeDate) &&
    values.every((value) => Number.isFinite(value) && value > 0) &&
    bar.high >= bar.low &&
    bar.high >= bar.open &&
    bar.high >= bar.close &&
    bar.low <= bar.open &&
    bar.low <= bar.close
  );
}

function orderedTargets(tip: EvalTip): Array<{ label: string; price: number }> {
  const clean = tip.targets.filter((target) => Number.isFinite(target.price) && target.price > 0 && target.label.trim());
  return tip.side === "BUY"
    ? [...clean].sort((a, b) => a.price - b.price)
    : [...clean].sort((a, b) => b.price - a.price);
}

function touchedTarget(side: TipSide, bar: DailyBar, price: number): boolean {
  return side === "BUY" ? bar.high >= price : bar.low <= price;
}

function touchedStop(side: TipSide, bar: DailyBar, stop: number): boolean {
  if (!(stop > 0)) return false;
  return side === "BUY" ? bar.low <= stop : bar.high >= stop;
}
