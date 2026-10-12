import { activeFeedId, type FeedId, type QuoteSnapshot } from "@/server/market-data/quotes";

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
  status: "mock" | "live" | "degraded" | "unavailable";
  licensed: boolean;
  label: string;
  checkedAt: string;
};

export interface MarketDataProvider {
  readonly id: FeedId;
  health(now?: Date): ProviderHealth;
  getSampleQuotes(symbols: string[]): Promise<SampleQuote[]>;
  getQuotes(symbols: string[]): Promise<QuoteSnapshot[]>;
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
  readonly id = "mock" as const;

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

  async getQuotes(symbols: string[]): Promise<QuoteSnapshot[]> {
    const now = new Date().toISOString();
    return symbols.map((symbol) => {
      const known = Object.prototype.hasOwnProperty.call(SAMPLE_LAST, symbol);
      return {
        symbol,
        last: known ? SAMPLE_LAST[symbol]?.last ?? null : null,
        changePct: known ? SAMPLE_LAST[symbol]?.changePct ?? null : null,
        sourceTimestamp: null,
        updatedAt: now,
        providerId: "mock",
      };
    });
  }
}

export function getMarketDataProvider(): MarketDataProvider {
  const feed = activeFeedId();
  if (feed === "mock") return new MockMarketDataProvider();
  return new RemoteFeedProvider(feed);
}

class RemoteFeedProvider implements MarketDataProvider {
  constructor(readonly id: FeedId) {}

  health(now = new Date()): ProviderHealth {
    const licensed = process.env.MARKET_DATA_LICENSED === "true";
    if (this.id === "dev") {
      return {
        providerId: this.id,
        status: "degraded",
        licensed: false,
        label: "Dev quotes from a public chart endpoint. Disabled in production. Not a broker feed.",
        checkedAt: now.toISOString(),
      };
    }
    const configured = Boolean(process.env.ALICEBLUE_USER_ID && (process.env.ALICEBLUE_API_KEY || process.env.ALICEBLUE_SESSION_ID));
    return {
      providerId: this.id,
      status: configured ? "live" : "unavailable",
      licensed,
      label: configured
        ? "Alice Blue session feed. Broker credentials stay on the server. Redistribution rights are still open."
        : "Alice Blue is selected, but ALICEBLUE_USER_ID and ALICEBLUE_API_KEY are empty.",
      checkedAt: now.toISOString(),
    };
  }

  async getSampleQuotes(symbols: string[]): Promise<SampleQuote[]> {
    return new MockMarketDataProvider().getSampleQuotes(symbols);
  }

  async getQuotes(symbols: string[]): Promise<QuoteSnapshot[]> {
    const { rememberedQuote } = await import("@/server/market-data/hub");
    const now = new Date().toISOString();
    return symbols.map((symbol) => rememberedQuote(symbol) ?? {
      symbol,
      last: null,
      changePct: null,
      sourceTimestamp: null,
      updatedAt: now,
      providerId: this.id,
    });
  }
}
