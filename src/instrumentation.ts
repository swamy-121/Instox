export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootMarketFeed } = await import("./instrumentation-node");
    await bootMarketFeed();
  }
}
