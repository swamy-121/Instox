import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeDisplayed, shownQuote } from "@/features/market/live-quotes";
import { MockMarketDataProvider, getMarketDataProvider } from "@/server/market-data/adapter";
import { aliceConnectFrame, loginAliceBlue, openAliceSocketSession } from "@/server/market-data/aliceblue";
import {
  activeFeedId,
  aliceSocketToken,
  aliceUserData,
  applyLiveClose,
  decodeFrame,
  freshnessOf,
  overlayQuote,
  parseAliceTick,
  parseScripSearch,
  parseYahooChart,
  subscribeKey,
  type QuoteSnapshot,
} from "@/server/market-data/quotes";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("market feed helpers", () => {
  it("builds the Alice Blue login hash and socket token", () => {
    expect(aliceUserData("AB1", "secret-key", "enc")).toBe("acc1f7fd27f424af08975c3bde1597d3416dde004a11e439dfe40042f998a012");
    expect(aliceSocketToken("sid-1")).toBe("3fbaaee3555526e597cf344100bda8842c499d351f4b5ca63193834e1af7e7bb");
    const frame = JSON.parse(aliceConnectFrame({ userId: "AB1", sessionId: "sid-1" })) as { susertoken: string; actid: string };
    expect(frame.susertoken).toBe(aliceSocketToken("sid-1"));
    expect(frame.actid).toBe("AB1_API");
    expect(JSON.stringify(frame)).not.toContain("secret-key");
  });

  it("logs in with hashed user data and refuses a socket session that is not Ok", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(init?.body ?? ""));
      const url = String(input);
      if (url.includes("getAPIEncpkey")) return new Response(JSON.stringify({ encKey: "enc" }), { status: 200 });
      return new Response(JSON.stringify({ sessionID: "sid-1" }), { status: 200 });
    }) as typeof fetch;
    const session = await loginAliceBlue({ userId: "ab1", apiKey: "secret-key", fetchImpl });
    expect(session).toEqual({ userId: "AB1", sessionId: "sid-1" });
    expect(JSON.parse(calls[1] ?? "{}")).toMatchObject({ userData: aliceUserData("AB1", "secret-key", "enc") });
    expect(calls.join("")).not.toContain("secret-key");

    const denied = (async () => new Response(JSON.stringify({ stat: "Not_ok" }), { status: 200 })) as typeof fetch;
    await expect(openAliceSocketSession(session, denied)).rejects.toThrow(/socket session/);
    const allowed = (async () => new Response(JSON.stringify({ stat: "Ok" }), { status: 200 })) as typeof fetch;
    await expect(openAliceSocketSession(session, allowed)).resolves.toBeUndefined();
  });

  it("parses ticks, search rows, and public chart payloads", async () => {
    expect(subscribeKey([{ exchange: "NSE", token: "26000" }, { exchange: "BSE", token: "1" }])).toBe("NSE|26000#BSE|1");
    expect(parseAliceTick(JSON.stringify({ t: "tk", e: "NSE", tk: "26000", lp: "24635.5", pc: "0.82", ft: 1700000000 }))).toMatchObject({
      exchange: "NSE",
      token: "26000",
      last: 24635.5,
      changePct: 0.82,
    });
    expect(parseAliceTick(JSON.stringify({ t: "tf", e: "BSE", tk: "1", lp: "10" }))?.last).toBe(10);
    expect(parseAliceTick("not-json")).toBeNull();
    expect(parseAliceTick(JSON.stringify({ t: "ck", s: "OK" }))).toBeNull();
    expect(parseScripSearch({
      result: [
        { symbol: "RELIANCE-EQ", token: "999", exch: "NSE", expiry: "2026-10-30" },
        { formattedInsName: "RELIANCE", token: "2885", exch: "NSE", expiry: "" },
      ],
    }, "RELIANCE")).toEqual({ exchange: "NSE", token: "2885" });
    const chart = parseYahooChart({
      chart: {
        result: [{
          meta: { regularMarketPrice: 100, chartPreviousClose: 80, regularMarketTime: 1700000000 },
          indicators: { quote: [{ close: [80, null, 100] }] },
        }],
      },
    });
    expect(chart).toMatchObject({ last: 100, changePct: 25, closes: [80, 100] });
    expect(await decodeFrame(new Uint8Array([116, 107]))).toBe("tk");
  });

  it("marks quotes live, stale, offline, or stored", () => {
    const now = Date.parse("2026-10-12T00:00:21.000Z");
    const fresh: QuoteSnapshot = {
      symbol: "NIFTY",
      last: 100,
      changePct: 1,
      sourceTimestamp: null,
      updatedAt: "2026-10-12T00:00:10.000Z",
      providerId: "aliceblue",
    };
    expect(freshnessOf(fresh, "aliceblue", now)).toBe("live");
    expect(freshnessOf({ ...fresh, updatedAt: "2026-10-12T00:00:00.000Z" }, "aliceblue", now)).toBe("stale");
    expect(freshnessOf({ ...fresh, last: null }, "aliceblue", now)).toBe("offline");
    expect(freshnessOf(fresh, "mock", now)).toBe("stored");
    const overlaid = overlayQuote({ symbol: "NIFTY", last: 1, changePct: 0 }, { ...fresh, updatedAt: "2026-10-12T00:00:00.000Z" }, "aliceblue", now);
    expect(overlaid).toMatchObject({ last: 100, changePct: 1, freshnessStatus: "stale" });
    expect(applyLiveClose([{ close: 1, closeTime: "a" }, { close: 2, closeTime: "b" }], 100, "c")).toEqual([
      { close: 1, closeTime: "a" },
      { close: 100, closeTime: "c" },
    ]);
  });

  it("keeps quote snapshots free of broker credentials", () => {
    const snapshot: QuoteSnapshot = {
      symbol: "NIFTY",
      last: 1,
      changePct: 0.1,
      sourceTimestamp: null,
      updatedAt: "2026-10-12T00:00:00.000Z",
      providerId: "aliceblue",
    };
    expect(Object.keys(snapshot).sort()).toEqual(["changePct", "last", "providerId", "sourceTimestamp", "symbol", "updatedAt"]);
    expect(JSON.stringify(snapshot)).not.toMatch(/apiKey|sessionId|sessionID|encKey|susertoken/);
  });

  it("selects mock unless aliceblue or a non-production dev feed is configured", async () => {
    expect(activeFeedId({ NODE_ENV: "test" })).toBe("mock");
    expect(activeFeedId({ NODE_ENV: "test", MARKET_DATA_PROVIDER: "aliceblue" })).toBe("aliceblue");
    expect(activeFeedId({ NODE_ENV: "development", MARKET_DATA_PROVIDER: "dev" })).toBe("dev");
    expect(activeFeedId({ NODE_ENV: "production", MARKET_DATA_PROVIDER: "dev" })).toBe("mock");

    vi.stubEnv("MARKET_DATA_PROVIDER", "");
    expect(getMarketDataProvider().id).toBe("mock");
    const sample = await new MockMarketDataProvider().getSampleQuotes(["NIFTY", "UNKNOWN"]);
    expect(sample[0]).toMatchObject({ dataLabel: "Sample data", live: false, quoteType: "sample" });
    expect(sample[1]?.freshnessStatus).toBe("unavailable");

    vi.stubEnv("MARKET_DATA_PROVIDER", "dev");
    vi.stubEnv("NODE_ENV", "production");
    expect(getMarketDataProvider().id).toBe("mock");
  });

  it("downgrades a dropped stream to stale and keeps the last price", () => {
    const row = { symbol: "NIFTY", last: 10, changePct: 1, freshnessStatus: "live" };
    const streamed = { symbol: "NIFTY", last: 12, changePct: 2, updatedAt: "2026-10-12T00:00:00.000Z" };
    const now = Date.parse("2026-10-12T00:00:05.000Z");
    expect(mergeDisplayed(row, streamed, "aliceblue", false, now)).toMatchObject({ last: 12, changePct: 2, freshnessStatus: "live" });
    expect(mergeDisplayed(row, streamed, "aliceblue", true, now)).toMatchObject({ last: 12, freshnessStatus: "stale" });
    expect(mergeDisplayed(row, undefined, "mock", true, now).freshnessStatus).toBe("stored");
    expect(shownQuote(undefined, undefined, "aliceblue", false, now)?.freshnessStatus).toBe("offline");
    expect(shownQuote(undefined, undefined, "mock", false, now)).toBeNull();
  });
});
