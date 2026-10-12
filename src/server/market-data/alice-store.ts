import { readSetting, writeSetting } from "@/server/db/settings";
import { runtimeEnv } from "@/server/integrations/store";
import { isAliceSessionCurrent, istClock, type StoredAliceSession } from "@/server/market-data/session";

const DOC_ID = "aliceblue";

export type AliceConnection = {
  connected: boolean;
  configured: boolean;
  tradingDay: string | null;
  userId: string | null;
  clientId: string | null;
  userSession: string | null;
  reminderSentOn: string | null;
};

export function aliceConfigured(env: Record<string, string | undefined> = runtimeEnv()): boolean {
  return Boolean(env.ALICEBLUE_APP_CODE && env.ALICEBLUE_API_SECRET);
}

function storedSession(data: Record<string, unknown> | null): StoredAliceSession | null {
  if (!data) return null;
  return {
    userId: String(data.userId ?? ""),
    clientId: String(data.clientId ?? ""),
    userSession: String(data.userSession ?? ""),
    tradingDay: String(data.tradingDay ?? ""),
  };
}

export async function readAliceConnection(now = new Date()): Promise<AliceConnection> {
  const data = await readSetting(DOC_ID);
  const session = storedSession(data);
  const connected = isAliceSessionCurrent(session, now);
  return {
    connected,
    configured: aliceConfigured(),
    tradingDay: connected ? session?.tradingDay ?? null : null,
    userId: connected ? session?.userId ?? null : null,
    clientId: connected ? session?.clientId ?? null : null,
    userSession: connected ? session?.userSession ?? null : null,
    reminderSentOn: data?.reminderSentOn ? String(data.reminderSentOn) : null,
  };
}

export async function saveAliceSession(input: { userId: string; clientId: string; userSession: string }, now = new Date()): Promise<void> {
  const current = (await readSetting(DOC_ID)) ?? {};
  await writeSetting(DOC_ID, {
    ...current,
    userId: input.userId,
    clientId: input.clientId,
    userSession: input.userSession,
    tradingDay: istClock(now).date,
    connectedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
}

export async function markAliceReminderSent(day: string, now = new Date()): Promise<void> {
  const current = (await readSetting(DOC_ID)) ?? {};
  await writeSetting(DOC_ID, { ...current, reminderSentOn: day, updatedAt: now.toISOString() });
}

export function publicAliceStatus(connection: AliceConnection, provider: string): {
  provider: string;
  connected: boolean;
  configured: boolean;
} {
  return {
    provider,
    connected: provider === "aliceblue" ? connection.connected : false,
    configured: connection.configured,
  };
}
