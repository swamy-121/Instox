import { isAppError } from "@/lib/errors";
import { adminDb } from "@/server/db/admin";
import { sampleInstruments, validateInstrumentImport, type InstrumentMaster } from "@/server/market-data/instruments";

export async function loadInstruments(): Promise<InstrumentMaster[]> {
  const merged = new Map(sampleInstruments().map((item) => [item.symbol, item]));
  try {
    const snap = await adminDb().collection("instruments").get();
    for (const doc of snap.docs) {
      try {
        const data = doc.data();
        const instrument = validateInstrumentImport(
          { ...data, symbol: data.symbol ?? doc.id },
          { licensed: process.env.MARKET_DATA_LICENSED === "true" },
        );
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
