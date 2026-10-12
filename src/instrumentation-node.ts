export async function bootMarketFeed(): Promise<void> {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.VITEST) return;
  const { startMarketFeed } = await import("@/server/market-data/hub");
  startMarketFeed();
}
