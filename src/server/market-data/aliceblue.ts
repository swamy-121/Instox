import { aliceChecksum } from "@/server/market-data/session";
import { aliceSocketToken, aliceUserData, parseScripSearch } from "@/server/market-data/quotes";

const REST_BASE = "https://ant.aliceblueonline.com/rest/AliceBlueAPIService/api/";
const SEARCH_URL = "https://ant.aliceblueonline.com/rest/DataApiService/v2/exchange/getScripForSearchAPI";
export const ALICE_SOCKET_URL = "wss://ws1.aliceblueonline.com/NorenWS/";

export type AliceSession = { userId: string; sessionId: string };

type FetchLike = typeof fetch;

function authHeader(session: AliceSession): string {
  return `Bearer ${session.userId} ${session.sessionId}`;
}

export async function loginAliceBlue(input: {
  userId: string;
  apiKey: string;
  sessionId?: string;
  fetchImpl?: FetchLike;
}): Promise<AliceSession> {
  const userId = input.userId.trim().toUpperCase();
  const fetchImpl = input.fetchImpl ?? fetch;
  if (!userId) throw new Error("Alice Blue user id is empty.");
  if (input.apiKey) {
    const encResponse = await fetchImpl(`${REST_BASE}customer/getAPIEncpkey`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-SAS-Version": "2.0" },
      body: JSON.stringify({ userId }),
    });
    const encBody = (await encResponse.json()) as { encKey?: string };
    if (!encResponse.ok || !encBody.encKey) throw new Error("Alice Blue did not return an encryption key.");
    const sessionResponse = await fetchImpl(`${REST_BASE}customer/getUserSID`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-SAS-Version": "2.0" },
      body: JSON.stringify({ userId, userData: aliceUserData(userId, input.apiKey, encBody.encKey) }),
    });
    const sessionBody = (await sessionResponse.json()) as { sessionID?: string };
    if (!sessionResponse.ok || !sessionBody.sessionID) throw new Error("Alice Blue did not return a session.");
    return { userId, sessionId: sessionBody.sessionID };
  }
  if (input.sessionId) return { userId, sessionId: input.sessionId };
  throw new Error("Alice Blue needs an API key or an existing session id.");
}

export async function openAliceSocketSession(session: AliceSession, fetchImpl: FetchLike = fetch): Promise<void> {
  const headers = { "content-type": "application/json", authorization: authHeader(session) };
  await fetchImpl(`${REST_BASE}ws/invalidateSocketSess`, { method: "POST", headers, body: JSON.stringify({ loginType: "API" }) });
  const created = await fetchImpl(`${REST_BASE}ws/createSocketSess`, { method: "POST", headers, body: JSON.stringify({ loginType: "API" }) });
  let body: { stat?: string } = {};
  try {
    body = (await created.json()) as { stat?: string };
  } catch {
    body = {};
  }
  if (!created.ok || body.stat !== "Ok") throw new Error("Alice Blue did not open a socket session.");
}

export function aliceConnectFrame(session: AliceSession & { clientId?: string }): string {
  const account = session.clientId || session.userId;
  return JSON.stringify({
    susertoken: aliceSocketToken(session.sessionId),
    t: "c",
    actid: `${account}_API`,
    uid: `${account}_API`,
    source: "API",
  });
}

const OPEN_API = "https://a3.aliceblueonline.com/open-api/od/v1";
export const ALICE_LOGIN_URL = "https://ant.aliceblueonline.com/";

export async function exchangeAliceAuthCode(input: {
  userId: string;
  authCode: string;
  apiSecret: string;
  fetchImpl?: FetchLike;
}): Promise<{ userId: string; clientId: string; userSession: string }> {
  const userId = input.userId.trim().toUpperCase();
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${OPEN_API}/vendor/getUserDetails`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ checkSum: aliceChecksum(userId, input.authCode, input.apiSecret) }),
  });
  const body = (await response.json()) as { stat?: string; clientId?: string; userSession?: string };
  if (!response.ok || body.stat !== "Ok" || !body.userSession || !body.clientId) {
    throw new Error("Alice Blue did not return a session.");
  }
  return { userId, clientId: body.clientId, userSession: body.userSession };
}

export async function openAliceMarketSocket(
  session: { userId: string; userSession: string },
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const headers = { "content-type": "application/json", authorization: `Bearer ${session.userSession}` };
  const body = JSON.stringify({ source: "API", userId: session.userId });
  await fetchImpl(`${OPEN_API}/profile/invalidateWsSess`, { method: "POST", headers, body });
  const created = await fetchImpl(`${OPEN_API}/profile/createWsSess`, { method: "POST", headers, body });
  let payload: { status?: string; result?: Array<{ Status?: string }> } = {};
  try {
    payload = (await created.json()) as { status?: string; result?: Array<{ Status?: string }> };
  } catch {
    payload = {};
  }
  const accepted = payload.status === "Ok" || payload.result?.[0]?.Status === "OK";
  if (!created.ok || !accepted) throw new Error("Alice Blue did not open a socket session.");
}

export async function searchAliceContract(
  session: AliceSession,
  symbol: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ exchange: string; token: string } | null> {
  const response = await fetchImpl(SEARCH_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: authHeader(session) },
    body: JSON.stringify({ symbol, exchange: ["NSE", "BSE"] }),
  });
  if (!response.ok) return null;
  return parseScripSearch(await response.json(), symbol);
}
