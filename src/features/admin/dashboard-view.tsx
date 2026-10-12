"use client";

import { IndianRupee, Lightbulb, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AdminTitle, changeLabel } from "@/components/admin-ui";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";
import { CATEGORY_LABELS } from "@/lib/labels";
import { formatInr } from "@/lib/money";
import type { TipCategory } from "@/types/domain";

type Growth = { date: string; free: number; premium: number; revenue: number };
type Model = {
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
  growth: Growth[];
  categories: Array<{ category: string; count: number }>;
};

const COLORS = ["#027332", "#0194A8", "#7DCEA0", "#0F7A45", "#F0B429", "#8E6BB8", "#E8772E", "#4F6B5E"];

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: isoDay(from), to: isoDay(to) };
}

function shortDay(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
}

function categoryName(value: string): string {
  if (value in CATEGORY_LABELS) return CATEGORY_LABELS[value as TipCategory];
  return value;
}

export function DashboardView({ title, lede }: { title: string; lede: string }) {
  const initial = defaultRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [applied, setApplied] = useState(initial);
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [charts, setCharts] = useState(false);

  useEffect(() => {
    setCharts(true);
  }, []);

  function load(range: { from: string; to: string }) {
    setLoading(true);
    const params = new URLSearchParams(range);
    apiFetch<Model>(`/api/v1/admin/dashboard?${params.toString()}`).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setModel(result.data);
    });
  }

  useEffect(() => {
    load(applied);
  }, [applied]);

  const cards = model
    ? [
        { label: "Total Users", value: model.totalUsers.toLocaleString("en-IN"), change: model.usersChangePct, icon: Users },
        { label: "Premium Users", value: model.premiumUsers.toLocaleString("en-IN"), change: model.premiumChangePct, icon: TrendingUp },
        { label: "Total Revenue", value: formatInr(model.revenueMinor), change: model.revenueChangePct, icon: IndianRupee },
        { label: "Total Tips", value: model.totalTips.toLocaleString("en-IN"), change: model.tipsChangePct, icon: Lightbulb },
      ]
    : [];

  return (
    <div>
      <AdminTitle
        title={title}
        lede={lede}
        action={
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setApplied({ from, to });
            }}
          >
            <label className="text-xs font-medium text-muted" htmlFor="dash-from">
              From
            </label>
            <input id="dash-from" className="field h-10 w-40" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <label className="text-xs font-medium text-muted" htmlFor="dash-to">
              To
            </label>
            <input id="dash-to" className="field h-10 w-40" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            <button className="btn-primary h-10" type="submit">
              Apply
            </button>
          </form>
        }
      />
      {error ? <ErrorState message={error} onRetry={() => load(applied)} /> : null}
      {loading && !model ? <LoadingState label="Loading dashboard" /> : null}
      {model ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => {
              const change = changeLabel(card.change);
              const Icon = card.icon;
              return (
                <article key={card.label} className="card flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted">{card.label}</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{card.value}</p>
                    <p className={`mt-2 text-xs font-semibold ${change.up === null ? "text-muted" : change.up ? "text-profit" : "text-loss"}`}>
                      {change.text}
                    </p>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                </article>
              );
            })}
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
            <section className="card">
              <h2 className="text-base font-semibold text-ink">User Growth</h2>
              <p className="text-xs text-muted">Free and premium signups, with recorded order totals on the line.</p>
              {charts && model.growth.length > 0 ? (
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={model.growth}>
                      <CartesianGrid stroke="#E5EFE9" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: "#4F6B5E" }} interval="preserveStartEnd" />
                      <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: "#4F6B5E" }} width={32} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#4F6B5E" }} width={48} />
                      <Tooltip labelFormatter={(label) => shortDay(String(label))} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="free" name="Free users" fill="#8FD19A" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="left" dataKey="premium" name="Premium users" fill="#027332" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" dataKey="revenue" name="Revenue (Rs)" stroke="#0194A8" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-6">
                  <EmptyState title="No growth in this range" body="Widen the dates to see signups and recorded orders." />
                </div>
              )}
            </section>
            <section className="card">
              <h2 className="text-base font-semibold text-ink">Tips by Category</h2>
              {charts && model.categories.length > 0 ? (
                <div className="mt-2 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={model.categories.map((entry) => ({ name: categoryName(entry.category), count: entry.count }))}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={86}
                        paddingAngle={2}
                      >
                        {model.categories.map((entry, index) => (
                          <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                      <text x="50%" y="44%" textAnchor="middle" fill="#013316" fontSize="20" fontWeight="600">
                        {model.categories.reduce((sum, entry) => sum + entry.count, 0)}
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-6">
                  <EmptyState title="No tips in this range" body="Tips created between these dates show up here." />
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
