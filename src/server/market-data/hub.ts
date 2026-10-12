import { LIVE_INDEX_SYMBOLS } from "@/lib/live-indices";
import { refreshIntegrations } from "@/server/integrations/store";
import { adminDb } from "@/server/db/admin";
import { readAliceConnection } from "@/server/market-data/alice-store";
import { aliceConnectFrame, ALICE_SOCKET_URL, openAliceMarketSocket, type AliceSession } from "@/server/market-data/aliceblue";
import { maybeSendAliceReminder } from "@/server/market-data/reminder";
import {
  activeFeedId,
  ALICE_INDEX_CONTRACTS,
  decodeFrame,
  isLiveIndex,
  parseAliceTick,
  parseYahooChart,
  subscribeKey,
  yahooSymbol,
  type FeedId,
  type QuoteSnapshot,
} from "@/server/market-data/quotes";

const memory = new Map<string, QuoteSnapshot>();
const contracts = new Map<string, { exchange: string; token: string }>();
const tokenIndex = new Map<string, string>();
let started = false;
let loops = false;
let activeDay = "";
let generation = 0;

export function rememberedQuote(symbol: string): QuoteSnapshot | undefined {
  return memory.get(symbol);
}

export function quoteCacheSnapshot(): QuoteSnapshot[] {
  return [...memory.values()].filter((quote) => isLiveIndex(quote.symbol));
}

export function rememberQuote(snapshot: QuoteSnapshot): void {
  memory.set(snapshot.symbol, snapshot);
}

function liveSymbols(): string[] {
  return [...LIVE_INDEX_SYMBOLS];
}

async function flush(providerId: FeedId): Promise<void> {
  const rows = [...memory.values()].filter((snapshot) => snapshot.providerId === providerId && snapshot.last !== null);
  if (rows.length === 0) return;
  const db = adminDb();
  const batch = db.batch();
  for (const snapshot of rows) {
    batch.set(db.collection("marketQuotes").doc(snapshot.symbol), snapshot, { merge: true });
  }
  await batch.commit();
}

async function pollDev(symbols: string[]): Promise<void> {
  await Promise.all(symbols.map(async (symbol) => {
    try {
      const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol))}?interval=1d&range=5d`, {
        headers: { "user-agent": "instox-dev-quotes" },
      });
      if (!response.ok) return;
      const parsed = parseYahooChart(await response.json());
      if (!parsed) return;
      rememberQuote({
        symbol,
        last: parsed.last,
        changePct: parsed.changePct,
        sourceTimestamp: parsed.at,
        updatedAt: new Date().toISOString(),
        providerId: "dev",
      });
    } catch {
      // A missed public quote leaves the previous snapshot in place.
    }
  }));
}

function bindIndexContracts(): void {
  contracts.clear();
  tokenIndex.clear();
  for (const symbol of LIVE_INDEX_SYMBOLS) {
    const known = ALICE_INDEX_CONTRACTS[symbol];
    if (!known) continue;
    contracts.set(symbol, known);
    tokenIndex.set(`${known.exchange}|${known.token}`, symbol);
  }
}

function connectAlice(session: AliceSession & { clientId?: string }, gen: number): void {
  const socket = new WebSocket(ALICE_SOCKET_URL);
  const beat = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ k: "", t: "h" }));
  }, 50_000);
  socket.addEventListener("open", () => {
    socket.send(aliceConnectFrame(session));
  });
  socket.addEventListener("message", (event) => {
    void decodeFrame(event.data).then((text) => {
      if (!text || gen !== generation) return;
      let body: { t?: string; s?: string; k?: string } | null = null;
      try {
        body = JSON.parse(text) as { t?: string; s?: string; k?: string };
      } catch {
        body = null;
      }
      const ready = (body?.t === "ck" && body.s === "OK") || (body?.t === "cf" && (body.k === "OK" || body.s === "OK"));
      if (ready) {
        const key = subscribeKey([...contracts.values()]);
        if (key) socket.send(JSON.stringify({ k: key, t: "t" }));
        return;
      }
      const tick = parseAliceTick(text);
      if (!tick) return;
      const symbol = tokenIndex.get(`${tick.exchange}|${tick.token}`);
      if (!symbol || !isLiveIndex(symbol)) return;
      rememberQuote({
        symbol,
        last: tick.last,
        changePct: tick.changePct,
        sourceTimestamp: tick.at,
        updatedAt: new Date().toISOString(),
        providerId: "aliceblue",
      });
    });
  });
  socket.addEventListener("close", () => {
    clearInterval(beat);
    setTimeout(() => {
      if (gen === generation && activeFeedId() === "aliceblue") connectAlice(session, gen);
    }, 5000);
  });
}

async function ensureAlice(): Promise<void> {
  const connection = await readAliceConnection();
  if (!connection.connected || !connection.userSession || !connection.userId || !connection.clientId || !connection.tradingDay) {
    generation += 1;
    activeDay = "";
    return;
  }
  if (activeDay === connection.tradingDay) return;
  generation += 1;
  const gen = generation;
  activeDay = connection.tradingDay;
  try {
    await openAliceMarketSocket({ userId: connection.userId, userSession: connection.userSession });
    bindIndexContracts();
    connectAlice({ userId: connection.userId, sessionId: connection.userSession, clientId: connection.clientId }, gen);
  } catch {
    if (gen === generation) activeDay = "";
  }
}

export function startMarketFeed(): void {
  if (started) return;
  started = true;
  const watch = () => {
    void refreshIntegrations()
      .catch(() => undefined)
      .then(() => armMarketFeed(activeFeedId()));
  };
  watch();
  setInterval(watch, 60_000);
}

function armMarketFeed(feed: FeedId): void {
  if (loops || feed === "mock") return;
  loops = true;
  if (feed === "dev") {
    const tick = () => {
      void pollDev(liveSymbols()).then(() => flush("dev")).catch(() => undefined);
    };
    tick();
    setInterval(tick, 60_000);
    return;
  }
  const boot = () => {
    void ensureAlice().catch(() => undefined);
    void maybeSendAliceReminder().catch(() => undefined);
  };
  boot();
  setInterval(boot, 30_000);
  setInterval(() => {
    void flush("aliceblue").catch(() => undefined);
  }, 2000);
}

export async function loadFeedQuotes(symbols: string[]): Promise<Map<string, QuoteSnapshot>> {
  const found = new Map<string, QuoteSnapshot>();
  for (const symbol of symbols) {
    const cached = memory.get(symbol);
    if (cached) found.set(symbol, cached);
  }
  const missing = symbols.filter((symbol) => !found.has(symbol));
  if (missing.length === 0) return found;
  const db = adminDb();
  const snaps = await Promise.all(missing.map((symbol) => db.collection("marketQuotes").doc(symbol).get()));
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data() ?? {};
    const last = Number(data.last);
    found.set(snap.id, {
      symbol: snap.id,
      last: Number.isFinite(last) ? last : null,
      changePct: Number.isFinite(Number(data.changePct)) ? Number(data.changePct) : null,
      sourceTimestamp: data.sourceTimestamp ? String(data.sourceTimestamp) : null,
      updatedAt: String(data.updatedAt ?? ""),
      providerId: data.providerId === "dev" ? "dev" : "aliceblue",
    });
  }
  return found;
}
