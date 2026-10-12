import { createHash } from "node:crypto";

export const NSE_HOLIDAYS_2026 = [
  "2026-01-26",
  "2026-03-03",
  "2026-03-26",
  "2026-03-31",
  "2026-04-03",
  "2026-04-14",
  "2026-05-01",
  "2026-05-28",
  "2026-06-26",
  "2026-09-14",
  "2026-10-02",
  "2026-10-20",
  "2026-11-10",
  "2026-11-24",
  "2026-12-25",
] as const;

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export type IstClock = { date: string; hour: number; minute: number; weekday: number };

export type StoredAliceSession = {
  userId: string;
  clientId: string;
  userSession: string;
  tradingDay: string;
};

export function aliceChecksum(userId: string, authCode: string, apiSecret: string): string {
  return createHash("sha256").update(`${userId}${authCode}${apiSecret}`).digest("hex");
}

export function istClock(now: Date): IstClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(value.hour);
  return {
    date: `${value.year}-${value.month}-${value.day}`,
    hour: hour === 24 ? 0 : hour,
    minute: Number(value.minute),
    weekday: WEEKDAYS[value.weekday ?? ""] ?? 0,
  };
}

export function isNseMarketDay(date: string, weekday = weekdayOf(date)): boolean {
  if (weekday === 0 || weekday === 6) return false;
  return !(NSE_HOLIDAYS_2026 as readonly string[]).includes(date);
}

export function isAliceSessionCurrent(session: StoredAliceSession | null, now: Date): boolean {
  if (!session?.userId || !session.clientId || !session.userSession || !session.tradingDay) return false;
  return session.tradingDay === istClock(now).date;
}

export function aliceReminderDue(input: {
  now: Date;
  provider: string;
  connected: boolean;
  reminderSentOn: string | null;
}): boolean {
  if (input.provider !== "aliceblue" || input.connected) return false;
  const clock = istClock(input.now);
  if (!isNseMarketDay(clock.date, clock.weekday)) return false;
  const minutes = clock.hour * 60 + clock.minute;
  if (minutes < 9 * 60 || minutes >= 15 * 60 + 30) return false;
  return input.reminderSentOn !== clock.date;
}

function weekdayOf(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return 0;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
