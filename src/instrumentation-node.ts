export async function bootMarketFeed(): Promise<void> {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.VITEST) return;
  if (process.env.DATABASE_URL) {
    const { migrateDatabase } = await import("@/server/db/client");
    await migrateDatabase().catch(() => {
      console.error(JSON.stringify({ route: "migrate", category: "INTERNAL_ERROR" }));
    });
  }
  const { startMarketFeed } = await import("@/server/market-data/hub");
  startMarketFeed();
}
