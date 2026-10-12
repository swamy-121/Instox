"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Chip, PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";

type Report = {
  calculationVersion: string;
  timezone: string;
  periodStart: string;
  periodEnd: string;
  populationDefinition: string;
  totalTips: number;
  wins: number;
  losses: number;
  unresolved: number;
  cancelled: number;
  winRate: number | null;
  winRateDenominator: string;
  assumptions: string[];
  rows: Array<{ id: string; symbol: string; outcome: string; accessTier: string; status: string }>;
};

export default function InsightsPage() {
  return (
    <AppFrame requireAuth>
      <InsightsBody />
    </AppFrame>
  );
}

function InsightsBody() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();

  function load() {
    setError(null);
    apiFetch<Report>("/api/v1/insights/history?days=30").then((result) => {
      if (!result.ok) {
        setError(result.message);
        setRequestId(result.requestId);
        return;
      }
      setReport(result.data);
    });
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Insights"
        lede="Last 30 Asia/Kolkata calendar days. Unresolved tips are not counted as wins."
        action={<Link href="/pulse" className="text-sm font-medium text-primary">Pulse</Link>}
      />
      {error ? <ErrorState message={error} requestId={requestId} onRetry={load} /> : null}
      {!report && !error ? <LoadingState label="Loading insights" /> : null}
      {report ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Win rate" value={report.winRate === null ? "n/a" : `${report.winRate}%`} />
            <Stat label="Wins" value={String(report.wins)} tone="profit" />
            <Stat label="Stop-loss losses" value={String(report.losses)} tone="loss" />
            <Stat label="Unresolved" value={String(report.unresolved)} />
          </div>
          <section className="card text-sm leading-6">
            <p className="font-medium text-ink">Version {report.calculationVersion}</p>
            <p className="mt-2 text-ink">{report.populationDefinition}</p>
            <p className="mt-2 text-muted">Denominator: {report.winRateDenominator}. Cancelled: {report.cancelled}. Population: {report.totalTips}.</p>
            <p className="mt-2 text-xs text-muted">{report.timezone}. {report.periodStart} to {report.periodEnd}</p>
          </section>
          {report.rows.length === 0 ? <EmptyState title="No tips in this window" body="Published tips in the last 30 days will appear here with their manual outcome." /> : null}
          <ul className="space-y-2">
            {report.rows.map((row) => (
              <li key={row.id} className="card flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-ink">{row.symbol}</span>
                <Chip tone={outcomeTone(row.outcome)}>{row.outcome}</Chip>
              </li>
            ))}
          </ul>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-muted">
            {report.assumptions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function outcomeTone(outcome: string): "profit" | "loss" | "neutral" {
  if (outcome === "win") return "profit";
  if (outcome === "loss") return "loss";
  return "neutral";
}

function statColor(tone: "ink" | "profit" | "loss") {
  if (tone === "profit") return "text-profit";
  if (tone === "loss") return "text-loss";
  return "text-ink";
}

function Stat({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "profit" | "loss" }) {
  const color = statColor(tone);
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${color}`}>{value}</p>
    </div>
  );
}
