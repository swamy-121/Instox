"use client";

import { useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ErrorState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Point = { closeTime: string; open: number; high: number; low: number; close: number; ema: number | null };
type Chart = { symbol: string; dataLabel: string; live: boolean; notice: string; candles: Point[] };

export default function ChartsPage() {
  return (
    <AppFrame requireAuth>
      <ChartsBody />
    </AppFrame>
  );
}

function ChartsBody() {
  const [symbol, setSymbol] = useState("RELIANCE");
  const [chart, setChart] = useState<Chart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function load(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await apiFetch<Chart>(`/api/v1/charts/${encodeURIComponent(symbol.trim())}?bars=40`);
    setBusy(false);
    if (!result.ok) {
      setChart(null);
      setError(result.message);
      setRequestId(result.requestId);
      return;
    }
    setChart(result.data);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Charts</h1>
        <p className="mt-1 text-sm text-muted">Daily sample candles with an EMA overlay. This is not a live chart.</p>
      </div>
      <form className="card flex flex-wrap items-end gap-3" onSubmit={(event) => void load(event)}>
        <label className="text-sm">
          <span className="label">Symbol</span>
          <input className="field" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} />
        </label>
        <button className="btn-primary" type="submit" disabled={busy}>Load sample chart</button>
      </form>
      {error ? <ErrorState message={error} requestId={requestId} /> : null}
      {chart ? (
        <section className="card space-y-3">
          <p className="text-sm">{chart.dataLabel}. Live: {chart.live ? "yes" : "no"}. {chart.notice}</p>
          <CandleChart candles={chart.candles} />
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-muted">
                <th className="py-1">Close time</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>Close</th>
                <th>EMA</th>
              </tr>
            </thead>
            <tbody>
              {chart.candles.slice(-5).map((candle) => (
                <tr key={candle.closeTime} className="tabular-nums">
                  <td className="py-1">{candle.closeTime.slice(0, 10)}</td>
                  <td>{candle.open}</td>
                  <td>{candle.high}</td>
                  <td>{candle.low}</td>
                  <td>{candle.close}</td>
                  <td>{candle.ema === null ? "n/a" : candle.ema.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

function CandleChart({ candles }: { candles: Point[] }) {
  const width = 640;
  const height = 220;
  const pad = 12;
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const span = max - min || 1;
  const xAt = (index: number) => pad + (index * (width - pad * 2)) / Math.max(candles.length - 1, 1);
  const yAt = (price: number) => pad + ((max - price) * (height - pad * 2)) / span;
  const closePath = candles.map((candle, index) => `${index === 0 ? "M" : "L"}${xAt(index)},${yAt(candle.close)}`).join(" ");
  const emaPoints = candles.filter((candle) => candle.ema !== null);
  const emaPath = candles
    .map((candle, index) => (candle.ema === null ? null : `${emaPoints[0] === candle && index === candles.findIndex((item) => item.ema !== null) ? "M" : "L"}${xAt(index)},${yAt(candle.ema)}`))
    .filter(Boolean)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-xl bg-canvas" role="img" aria-label="Sample candle chart">
      {candles.map((candle, index) => (
        <line key={candle.closeTime} x1={xAt(index)} x2={xAt(index)} y1={yAt(candle.high)} y2={yAt(candle.low)} stroke="#0D1B2A" strokeWidth="1" />
      ))}
      <path d={closePath} fill="none" stroke="#0F7A45" strokeWidth="2" />
      {emaPath ? <path d={emaPath} fill="none" stroke="#8A5A00" strokeWidth="1.5" /> : null}
    </svg>
  );
}
