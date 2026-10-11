export type SampleQuote = {
  symbol: string;
  last: number | null;
  sourceTimestamp: string | null;
  freshnessStatus: "sample" | "unavailable";
  dataLabel: "Sample data";
  live: false;
  quoteType: "sample";
};

export type ProviderHealth = {
  providerId: string;
  status: "mock" | "unavailable";
  licensed: false;
  label: string;
  checkedAt: string;
};

export interface MarketDataProvider {
  readonly id: string;
  health(now?: Date): ProviderHealth;
  getSampleQuotes(symbols: string[]): Promise<SampleQuote[]>;
}

const SAMPLE_LAST: Record<string, number> = {
  RELIANCE: 1000,
  TCS: 1000,
  HDFCBANK: 1000,
  INFY: 1000,
  SBIN: 1000,
  NIFTY: 1000,
  BANKNIFTY: 1000,
};

export class MockMarketDataProvider implements MarketDataProvider {
  readonly id = "mock";

  health(now = new Date()): ProviderHealth {
    return {
      providerId: this.id,
      status: "mock",
      licensed: false,
      label: "Sample adapter. Not a licensed market-data feed.",
      checkedAt: now.toISOString(),
    };
  }

  async getSampleQuotes(symbols: string[]): Promise<SampleQuote[]> {
    return symbols.map((symbol) => {
      const known = Object.prototype.hasOwnProperty.call(SAMPLE_LAST, symbol);
      return {
        symbol,
        last: known ? SAMPLE_LAST[symbol] ?? null : null,
        sourceTimestamp: null,
        freshnessStatus: known ? "sample" : "unavailable",
        dataLabel: "Sample data",
        live: false,
        quoteType: "sample",
      };
    });
  }
}

export function getMarketDataProvider(): MarketDataProvider {
  return new MockMarketDataProvider();
}
