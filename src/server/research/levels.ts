export type PriceLevel = {
  price: number;
  kind: "swing" | "pivot";
};

export type LevelSet = {
  price: number;
  supports: PriceLevel[];
  resistances: PriceLevel[];
  note: string;
};

type Bar = { high: number; low: number; close: number };

/** Swing turns, plus floor pivots from the previous bar. Levels can break. */
export function supportResistance(bars: Bar[], lookback = 2): LevelSet | null {
  if (bars.length < lookback * 2 + 2) return null;
  const last = bars[bars.length - 1];
  const previous = bars[bars.length - 2];
  if (!last || !previous || !(last.close > 0)) return null;

  const swings: PriceLevel[] = [];
  for (let index = lookback; index < bars.length - lookback; index += 1) {
    const bar = bars[index];
    if (!bar) continue;
    const left = bars.slice(index - lookback, index);
    const right = bars.slice(index + 1, index + 1 + lookback);
    if (left.every((item) => bar.high > item.high) && right.every((item) => bar.high >= item.high)) {
      swings.push({ price: bar.high, kind: "swing" });
    }
    if (left.every((item) => bar.low < item.low) && right.every((item) => bar.low <= item.low)) {
      swings.push({ price: bar.low, kind: "swing" });
    }
  }

  const pivot = (previous.high + previous.low + previous.close) / 3;
  const range = previous.high - previous.low;
  const pivots: PriceLevel[] = [
    { price: 2 * pivot - previous.low, kind: "pivot" },
    { price: pivot + range, kind: "pivot" },
    { price: 2 * pivot - previous.high, kind: "pivot" },
    { price: pivot - range, kind: "pivot" },
  ];

  const merged = cluster([...swings, ...pivots].filter((level) => level.price > 0));
  const supports = merged.filter((level) => level.price < last.close).sort((a, b) => b.price - a.price).slice(0, 3);
  const resistances = merged.filter((level) => level.price > last.close).sort((a, b) => a.price - b.price).slice(0, 3);

  return {
    price: round2(last.close),
    supports: supports.map(roundLevel),
    resistances: resistances.map(roundLevel),
    note: "These are places price turned, plus the usual pivot levels from the previous bar. They can break.",
  };
}

function cluster(levels: PriceLevel[]): PriceLevel[] {
  const sorted = [...levels].sort((a, b) => a.price - b.price);
  const groups: PriceLevel[][] = [];
  for (const level of sorted) {
    const current = groups[groups.length - 1];
    const anchor = current?.[0];
    if (!current || !anchor || Math.abs(level.price - anchor.price) / anchor.price > 0.008) {
      groups.push([level]);
    } else {
      current.push(level);
    }
  }
  return groups.map((group) => {
    const price = group.reduce((sum, level) => sum + level.price, 0) / group.length;
    const kind = group.some((level) => level.kind === "swing") ? "swing" : "pivot";
    return { price, kind };
  });
}

function roundLevel(level: PriceLevel): PriceLevel {
  return { price: round2(level.price), kind: level.kind };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
