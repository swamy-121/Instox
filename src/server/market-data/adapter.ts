export type SampleQuote = {
  symbol: string;
  last: number | null;
  sampleChangePct: number | null;
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

const SAMPLE_LAST: Record<string, { last: number; changePct: number }> = {
  RELIANCE: { last: 2946.5, changePct: 0.84 },
  TCS: { last: 4288.15, changePct: -0.36 },
  HDFCBANK: { last: 1742.8, changePct: 0.51 },
  INFY: { last: 1876.4, changePct: 1.12 },
  SBIN: { last: 812.35, changePct: -0.68 },
  NIFTY: { last: 25184.5, changePct: 0.27 },
  BANKNIFTY: { last: 52340, changePct: -0.19 },
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
        last: known ? SAMPLE_LAST[symbol]?.last ?? null : null,
        sampleChangePct: known ? SAMPLE_LAST[symbol]?.changePct ?? null : null,
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
