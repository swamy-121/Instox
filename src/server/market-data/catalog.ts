import { isAppError } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { instruments } from "@/server/db/schema";
import { sampleInstruments, validateInstrumentImport, type InstrumentMaster } from "@/server/market-data/instruments";

export async function loadInstruments(): Promise<InstrumentMaster[]> {
  const merged = new Map(sampleInstruments().map((item) => [item.symbol, item]));
  try {
    const rows = await getDb().select().from(instruments);
    for (const row of rows) {
      try {
        const instrument = validateInstrumentImport(row, { licensed: process.env.MARKET_DATA_LICENSED === "true" });
        merged.set(instrument.symbol, instrument);
      } catch (error) {
        if (!isAppError(error)) throw error;
      }
    }
  } catch (error) {
    if (isAppError(error)) throw error;
    return [...merged.values()];
  }
  return [...merged.values()];
}
