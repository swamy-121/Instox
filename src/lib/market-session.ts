/** NSE cash session in IST. Display only — it does not invent prices. */
const HOLIDAYS_2026 = new Set([
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
]);

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export type NseSession = { open: boolean; label: string };

export function nseSession(now = new Date()): NseSession {
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
  const minute = Number(value.minute);
  const weekday = WEEKDAYS[value.weekday ?? ""] ?? 0;
  const date = `${value.year}-${value.month}-${value.day}`;
  const minutes = (hour === 24 ? 0 : hour) * 60 + minute;
  const open = weekday >= 1 && weekday <= 5 && !HOLIDAYS_2026.has(date) && minutes >= 9 * 60 + 15 && minutes < 15 * 60 + 30;
  return { open, label: open ? "Market open" : "Market closed" };
}

export function formatIstStamp(iso: string | number | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export function formatIstDay(iso: string | number | Date = new Date()): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

export function absoluteMove(last: number, changePct: number): number | null {
  if (!Number.isFinite(last) || !Number.isFinite(changePct) || changePct <= -100) return null;
  const previous = last / (1 + changePct / 100);
  return last - previous;
}

export function isSampleData(label?: string | null, live?: boolean): boolean {
  if (live === true) return false;
  if (label && /sample|stored|mock/i.test(label)) return true;
  return live === false;
}
