import { readSetting } from "@/server/db/settings";
import { defaultIndicatorFlags, type IndicatorFlags } from "@/server/indicators/flags";

const KEYS = ["rsi", "ema", "cpr", "atr", "supertrend"] as const;

export async function loadRuntimeFlags(): Promise<IndicatorFlags> {
  const flags = defaultIndicatorFlags();
  try {
    const data = await readSetting("screener");
    if (!data) return flags;
    for (const key of KEYS) {
      if (typeof data[key] === "boolean") flags[key] = data[key];
    }
  } catch {
    return flags;
  }
  return flags;
}
