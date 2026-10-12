import features from "../../../config/features.json";

export const PULSE_VERSION = features.pulse.version;

export type PulseInput = {
  rsi: number | null;
  close: number | null;
  ema: number | null;
  cprTop: number | null;
  cprBottom: number | null;
};

export type PulseComponent = {
  id: "rsi" | "emaDistance" | "cprPosition";
  weight: number;
  score: number | null;
  note: string;
};

export type PulseScore = {
  version: string;
  score: number | null;
  components: PulseComponent[];
  missing: string[];
  limitations: string;
  renormalized: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Descriptive 0-100 blend. Missing inputs are dropped and the remaining weights are scaled
 * to sum to 1. If every input is missing, the score is null rather than zero.
 */
export function pulseScore(input: PulseInput, weights = features.pulse.weights): PulseScore {
  const components: PulseComponent[] = [];

  components.push({
    id: "rsi",
    weight: weights.rsi,
    score: input.rsi === null ? null : clamp(input.rsi, 0, 100),
    note: "RSI is used as a 0 to 100 reading. It is not a win probability.",
  });

  let emaScore: number | null = null;
  if (input.close !== null && input.ema !== null && input.ema !== 0) {
    const distancePct = ((input.close - input.ema) / input.ema) * 100;
    emaScore = clamp(50 + distancePct * 5, 0, 100);
  }
  components.push({
    id: "emaDistance",
    weight: weights.emaDistance,
    score: emaScore,
    note: "50 means price is on the EMA. Each 1 percent above adds 5 points, capped at 0 and 100.",
  });

  let cprScore: number | null = null;
  if (input.close !== null && input.cprTop !== null && input.cprBottom !== null) {
    if (input.close > input.cprTop) cprScore = 70;
    else if (input.close < input.cprBottom) cprScore = 30;
    else cprScore = 50;
  }
  components.push({
    id: "cprPosition",
    weight: weights.cprPosition,
    score: cprScore,
    note: "Above the CPR top is 70, inside the range is 50, below the bottom is 30.",
  });

  const present = components.filter((component) => component.score !== null && component.weight > 0);
  const missing = components.filter((component) => component.score === null).map((component) => component.id);
  if (present.length === 0) {
    return {
      version: PULSE_VERSION,
      score: null,
      components,
      missing,
      limitations: features.pulse.limitations,
      renormalized: false,
    };
  }
  const weightSum = present.reduce((sum, component) => sum + component.weight, 0);
  const score = present.reduce((sum, component) => sum + (component.score as number) * (component.weight / weightSum), 0);
  return {
    version: PULSE_VERSION,
    score: Math.round(score * 100) / 100,
    components,
    missing,
    limitations: features.pulse.limitations,
    renormalized: missing.length > 0,
  };
}
