import { adminDb } from "@/server/db/admin";
import { aliceConnectFrame, ALICE_SOCKET_URL, loginAliceBlue, openAliceSocketSession, searchAliceContract, type AliceSession } from "@/server/market-data/aliceblue";
import {
  activeFeedId,
  ALICE_INDEX_CONTRACTS,
  CORE_INDEX_SYMBOLS,
  decodeFrame,
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

export function rememberedQuote(symbol: string): QuoteSnapshot | undefined {
  return memory.get(symbol);
}

export function quoteCacheSnapshot(): QuoteSnapshot[] {
  return [...memory.values()];
}

export function rememberQuote(snapshot: QuoteSnapshot): void {
  memory.set(snapshot.symbol, snapshot);
}

async function universe(): Promise<string[]> {
  const db = adminDb();
  const [indices, tips, watch, instruments] = await Promise.all([
    db.collection("indices").limit(100).get(),
    db.collection("tips").limit(200).get(),
    db.collection("watchlistItems").limit(200).get(),
    db.collection("instruments").limit(100).get(),
  ]);
  const symbols = new Set<string>(CORE_INDEX_SYMBOLS);
  for (const doc of [...indices.docs, ...tips.docs, ...watch.docs, ...instruments.docs]) {
    const symbol = String(doc.data().symbol ?? "").toUpperCase();
    if (symbol) symbols.add(symbol);
  }
  return [...symbols];
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

function indexContract(symbol: string): { exchange: string; token: string } | undefined {
  return ALICE_INDEX_CONTRACTS[symbol];
}

async function resolveContracts(session: AliceSession, symbols: string[]): Promise<void> {
  contracts.clear();
  tokenIndex.clear();
  for (const symbol of symbols) {
    const known = indexContract(symbol);
    if (known) {
      contracts.set(symbol, known);
      tokenIndex.set(`${known.exchange}|${known.token}`, symbol);
      continue;
    }
    try {
      const found = await searchAliceContract(session, symbol);
      if (!found) continue;
      contracts.set(symbol, found);
      tokenIndex.set(`${found.exchange}|${found.token}`, symbol);
    } catch {
      // Skip a symbol the search call cannot resolve.
    }
  }
}

function connectAlice(session: AliceSession): void {
  const socket = new WebSocket(ALICE_SOCKET_URL);
  socket.addEventListener("open", () => {
    socket.send(aliceConnectFrame(session));
  });
  socket.addEventListener("message", (event) => {
    void decodeFrame(event.data).then((text) => {
      if (!text) return;
      let body: { t?: string; s?: string } | null = null;
      try {
        body = JSON.parse(text) as { t?: string; s?: string };
      } catch {
        body = null;
      }
      if (body?.t === "ck" && body.s === "OK") {
        const key = subscribeKey([...contracts.values()]);
        if (key) socket.send(JSON.stringify({ k: key, t: "t" }));
        return;
      }
      const tick = parseAliceTick(text);
      if (!tick) return;
      const symbol = tokenIndex.get(`${tick.exchange}|${tick.token}`);
      if (!symbol) return;
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
    setTimeout(() => {
      if (activeFeedId() === "aliceblue") connectAlice(session);
    }, 5000);
  });
}

async function startAlice(): Promise<void> {
  const userId = process.env.ALICEBLUE_USER_ID ?? "";
  const apiKey = process.env.ALICEBLUE_API_KEY ?? "";
  const sessionId = process.env.ALICEBLUE_SESSION_ID ?? "";
  if (!userId || (!apiKey && !sessionId)) return;
  const session = await loginAliceBlue({ userId, apiKey, sessionId });
  await openAliceSocketSession(session);
  await resolveContracts(session, await universe());
  connectAlice(session);
}

export function startMarketFeed(): void {
  if (started) return;
  const feed = activeFeedId();
  if (feed === "mock") return;
  started = true;
  if (feed === "dev") {
    const tick = () => {
      void universe().then((symbols) => pollDev(symbols)).then(() => flush("dev")).catch(() => undefined);
    };
    tick();
    setInterval(tick, 60_000);
    return;
  }
  const boot = () => {
    void startAlice().catch(() => {
      setTimeout(boot, 60_000);
    });
  };
  boot();
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
