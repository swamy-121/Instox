export type DashUser = { uid: string; createdAt: string };
export type DashTip = { category: string; createdAt: string };
export type DashOrder = { amountMinor: number; createdAt: string };

export type DashboardModel = {
  from: string;
  to: string;
  totalUsers: number;
  premiumUsers: number;
  revenueMinor: number;
  totalTips: number;
  usersChangePct: number | null;
  premiumChangePct: number | null;
  revenueChangePct: number | null;
  tipsChangePct: number | null;
  growth: Array<{ date: string; free: number; premium: number; revenue: number }>;
  categories: Array<{ category: string; count: number }>;
};

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) return days;
  while (cursor.getTime() <= end.getTime() && days.length < 400) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function previousWindow(from: string, to: string): { from: string; to: string } {
  const span = Math.max(eachDay(from, to).length, 1);
  const start = new Date(`${from}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - span);
  const end = new Date(`${from}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

function inRange(iso: string, from: string, to: string): boolean {
  const day = dayOf(iso);
  return day >= from && day <= to;
}

function changePct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function buildDashboard(input: {
  from: string;
  to: string;
  users: DashUser[];
  premiumUids: string[];
  tips: DashTip[];
  orders: DashOrder[];
}): DashboardModel {
  const premium = new Set(input.premiumUids);
  const previous = previousWindow(input.from, input.to);
  const days = eachDay(input.from, input.to);

  const createdIn = (from: string, to: string) => input.users.filter((user) => inRange(user.createdAt, from, to));
  const currentUsers = createdIn(input.from, input.to);
  const previousUsers = createdIn(previous.from, previous.to);
  const currentPremium = currentUsers.filter((user) => premium.has(user.uid)).length;
  const previousPremium = previousUsers.filter((user) => premium.has(user.uid)).length;

  const ordersIn = (from: string, to: string) =>
    input.orders.filter((order) => inRange(order.createdAt, from, to)).reduce((sum, order) => sum + order.amountMinor, 0);
  const tipsIn = (from: string, to: string) => input.tips.filter((tip) => inRange(tip.createdAt, from, to)).length;

  const growth = days.map((date) => {
    const born = input.users.filter((user) => dayOf(user.createdAt) === date);
    const premiumCount = born.filter((user) => premium.has(user.uid)).length;
    const revenueMinor = input.orders
      .filter((order) => dayOf(order.createdAt) === date)
      .reduce((sum, order) => sum + order.amountMinor, 0);
    return {
      date,
      free: born.length - premiumCount,
      premium: premiumCount,
      revenue: Math.round(revenueMinor) / 100,
    };
  });

  const counts = new Map<string, number>();
  for (const tip of input.tips) {
    if (!inRange(tip.createdAt, input.from, input.to)) continue;
    counts.set(tip.category, (counts.get(tip.category) ?? 0) + 1);
  }

  return {
    from: input.from,
    to: input.to,
    totalUsers: input.users.length,
    premiumUsers: input.users.filter((user) => premium.has(user.uid)).length,
    revenueMinor: input.orders.reduce((sum, order) => sum + order.amountMinor, 0),
    totalTips: input.tips.length,
    usersChangePct: changePct(currentUsers.length, previousUsers.length),
    premiumChangePct: changePct(currentPremium, previousPremium),
    revenueChangePct: changePct(ordersIn(input.from, input.to), ordersIn(previous.from, previous.to)),
    tipsChangePct: changePct(tipsIn(input.from, input.to), tipsIn(previous.from, previous.to)),
    growth,
    categories: [...counts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
  };
}
