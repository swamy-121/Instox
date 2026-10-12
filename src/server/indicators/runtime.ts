import { adminDb } from "@/server/db/admin";
import { defaultIndicatorFlags, type IndicatorFlags } from "@/server/indicators/flags";

const KEYS = ["rsi", "ema", "cpr", "atr", "supertrend"] as const;

export async function loadRuntimeFlags(): Promise<IndicatorFlags> {
  const flags = defaultIndicatorFlags();
  try {
    const snap = await adminDb().collection("appConfig").doc("screener").get();
    if (!snap.exists) return flags;
    const data = snap.data() ?? {};
    for (const key of KEYS) {
      if (typeof data[key] === "boolean") flags[key] = data[key];
    }
  } catch {
    return flags;
  }
  return flags;
}
