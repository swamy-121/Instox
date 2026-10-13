"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Chip, PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/money";

const UNDERLYINGS = ["NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN"];

type Idea = {
  optionType: "CE" | "PE";
  strike: number;
  expiry: string;
  premium: number;
  stopPremium: number;
  targetPremium: number;
  openInterest: number;
  note: string;
};

type Payload = {
  underlying: string;
  spot: number | null;
  source: string;
  tradeDate: string;
  dataLabel: string;
  notice: string;
  chainNote: string;
  summary: {
    pcr: number | null;
    maxPain: number | null;
    callWall: { strike: number; openInterest: number } | null;
    putWall: { strike: number; openInterest: number } | null;
    bias: "bullish" | "bearish" | "balanced";
    biasNote: string;
    callOi: number;
    putOi: number;
  };
  ideas: Idea[];
};

export default function OptionsPage() {
  return (
    <AppFrame requireAuth>
      <OptionsBody />
    </AppFrame>
  );
}

function OptionsBody() {
  const [underlying, setUnderlying] = useState("NIFTY");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load(symbol: string) {
    setLoading(true);
    setError(null);
    apiFetch<Payload>(`/api/v1/options?underlying=${encodeURIComponent(symbol)}`).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setPayload(null);
        setError(result.message);
        return;
      }
      setPayload(result.data);
    });
  }

  useEffect(() => {
    load(underlying);
  }, [underlying]);

  const summary = payload?.summary;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Option chain notes"
        lede="End-of-day open interest, put-call ratio, and a sketch for buying a call or a put. Time decay works against a bought option."
      />
      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {UNDERLYINGS.map((symbol) => (
          <button
            key={symbol}
            type="button"
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${underlying === symbol ? "bg-primary text-white" : "bg-canvas text-ink"}`}
            onClick={() => setUnderlying(symbol)}
          >
            {symbol}
          </button>
        ))}
      </div>
      {error ? <ErrorState message={error} onRetry={() => load(underlying)} /> : null}
      {loading && !payload ? <LoadingState label="Reading open interest" /> : null}
      {payload && summary ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Chip>{payload.dataLabel}</Chip>
            <span className="text-sm text-muted">{payload.tradeDate}{payload.spot ? ` · spot ${formatPrice(payload.spot)}` : ""}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Put-call ratio" value={summary.pcr === null ? "n/a" : summary.pcr.toFixed(2)} />
            <Stat label="Max pain" value={summary.maxPain === null ? "n/a" : formatPrice(summary.maxPain)} />
            <Stat label="Call wall" value={summary.callWall ? formatPrice(summary.callWall.strike) : "n/a"} />
            <Stat label="Put wall" value={summary.putWall ? formatPrice(summary.putWall.strike) : "n/a"} />
          </div>
          <section className="card text-sm leading-6">
            <p className="font-semibold text-ink">{biasLabel(summary.bias)}</p>
            <p className="mt-2 text-ink">{summary.biasNote}</p>
            <p className="mt-2 text-muted">Call interest {formatCount(summary.callOi)} · put interest {formatCount(summary.putOi)}</p>
          </section>
          {payload.ideas.length === 0 ? (
            <EmptyState title="No buying sketch" body="Open interest is balanced, so there is no call or put sketch for this snapshot." />
          ) : (
            payload.ideas.map((idea) => (
              <article key={`${idea.optionType}-${idea.strike}`} className="card space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-ink">{idea.optionType} {formatPrice(idea.strike)}</h2>
                  <Chip tone="info">{idea.expiry}</Chip>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <Mini label="Premium" value={formatPrice(idea.premium)} />
                  <Mini label="Sketch stop" value={formatPrice(idea.stopPremium)} />
                  <Mini label="Sketch target" value={formatPrice(idea.targetPremium)} />
                </div>
                <p className="text-sm leading-6 text-muted">{idea.note}</p>
              </article>
            ))
          )}
          <p className="text-sm leading-6 text-muted">{payload.chainNote} {payload.notice}</p>
        </>
      ) : null}
    </div>
  );
}

function biasLabel(bias: "bullish" | "bearish" | "balanced"): string {
  if (bias === "bullish") return "Puts are heavier";
  if (bias === "bearish") return "Calls are heavier";
  return "Interest is balanced";
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(value));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-canvas p-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}
