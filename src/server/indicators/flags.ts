import features from "../../../config/features.json";

export type IndicatorFlags = {
  rsi: boolean;
  ema: boolean;
  cpr: boolean;
  atr: boolean;
  supertrend: boolean;
};

export function defaultIndicatorFlags(): IndicatorFlags {
  return {
    rsi: features.indicators.rsi,
    ema: features.indicators.ema,
    cpr: features.indicators.cpr,
    atr: features.indicators.atr,
    supertrend: features.indicators.supertrend,
  };
}

export function assertIndicatorEnabled(flags: IndicatorFlags, name: keyof IndicatorFlags): void {
  if (!flags[name]) {
    throw new Error(`INDICATOR_DISABLED:${name}`);
  }
}
