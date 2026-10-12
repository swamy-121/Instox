/** The only instruments the live feed may subscribe to. */
export const LIVE_INDEX_SYMBOLS = ["NIFTY", "BANKNIFTY", "SENSEX"] as const;

export function isLiveIndex(symbol: string): boolean {
  return (LIVE_INDEX_SYMBOLS as readonly string[]).includes(symbol.toUpperCase());
}
