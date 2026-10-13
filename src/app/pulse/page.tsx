"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { SampleBadge } from "@/components/design";
import { Chip, PageHeader } from "@/components/ui";
import { isSampleData } from "@/lib/market-session";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/money";

type PulseResponse = {
  symbol: string;
  dataLabel: string;
  live: boolean;
  notice: string;
  pulse: {
    version: string;
    score: number | null;
    limitations: string;
    missing: string[];
    renormalized: boolean;
    components: Array<{ id: string; score: number | null; note: string; weight: number }>;
  };
};

type BoardCard = {
  symbol: string;
  last: number;
  rsi: number | null;
  rangePct: number | null;
  fit: "closer" | "looser";
  note: string;
  callStrike: number | null;
  putStrike: number | null;
};

type Boards = {
  dataLabel: string;
  notice: string;
  optionSelling: BoardCard[];
  sideways: BoardCard[];
  sellingNote: string;
  sidewaysNote: string;
};

const TABS = [
  { id: "score", label: "Score" },
  { id: "selling", label: "Option selling" },
  { id: "sideways", label: "Sideways" },
] as const;

export default function PulsePage() {
  return (
    <AppFrame requireAuth>
      <PulseBody />
    </AppFrame>
  );
}

function PulseBody() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("score");
  const [symbol, setSymbol] = useState("RELIANCE");
  const [result, setResult] = useState<PulseResponse | null>(null);
  const [boards, setBoards] = useState<Boards | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [loadingBoards, setLoadingBoards] = useState(true);

  useEffect(() => {
    apiFetch<Boards>("/api/v1/pulse/boards").then((response) => {
      setLoadingBoards(false);
      if (!response.ok) {
        setError(response.message);
        setRequestId(response.requestId);
        return;
      }
      setBoards(response.data);
    });
  }, []);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await apiFetch<PulseResponse>(`/api/v1/pulse?symbol=${encodeURIComponent(symbol.trim())}`);
    setBusy(false);
    if (!response.ok) {
      setResult(null);
      setError(response.message);
      setRequestId(response.requestId);
      return;
    }
    setResult(response.data);
  }

  const cards = tab === "selling" ? boards?.optionSelling ?? [] : boards?.sideways ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        embedded
        title="Pulse"
        lede="A score for one symbol, plus names that look quiet enough for an option-selling map or a sideways read. None of this is a promise of returns."
      />
      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${tab === item.id ? "bg-primary text-white" : "bg-canvas text-ink"}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? <ErrorState message={error} requestId={requestId} /> : null}
      {tab === "score" ? (
        <>
          <form className="card flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={(event) => void run(event)}>
            <label className="block flex-1">
              <span className="label">Symbol</span>
              <input className="field" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} />
            </label>
            <button className="btn-primary w-full sm:w-auto" type="submit" disabled={busy}>Calculate</button>
          </form>
          {result ? (
            <section className="card space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{result.dataLabel}</p>
                {isSampleData(result.dataLabel, result.live) ? <SampleBadge /> : <Chip>Live file</Chip>}
              </div>
              <p className="text-4xl font-semibold tabular-nums tracking-tight text-ink">{result.pulse.score === null ? "n/a" : result.pulse.score}</p>
              <p className="text-sm text-muted">{result.pulse.version}. {result.notice}</p>
              <ul className="space-y-2 text-sm">
                {result.pulse.components.map((component) => (
                  <li key={component.id}>
                    <span className="font-medium">{component.id}</span>
                    <span className="text-muted"> · weight {component.weight} · {component.score === null ? "missing" : component.score}</span>
                    <span className="mt-1 block text-xs text-muted">{component.note}</span>
                  </li>
                ))}
              </ul>
              {result.pulse.renormalized ? <p className="text-xs text-muted">Some data was missing, so the score uses what is available.</p> : null}
              <p className="text-sm">{result.pulse.limitations}</p>
            </section>
          ) : null}
        </>
      ) : null}
      {tab !== "score" && loadingBoards ? <LoadingState label="Reading the board" /> : null}
      {tab !== "score" && boards ? (
        <>
          <p className="text-sm leading-6 text-muted">{tab === "selling" ? boards.sellingNote : boards.sidewaysNote} {boards.notice}</p>
          {cards.length === 0 ? (
            <EmptyState
              title="Nothing fits"
              body="None of the sample names are quiet enough for this tab. Try again after an end-of-day file is saved."
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {cards.map((card) => (
                <li key={card.symbol} className="card space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{card.symbol}</p>
                      <p className="text-sm tabular-nums text-muted">{formatPrice(card.last)}</p>
                    </div>
                    <Chip tone={card.fit === "closer" ? "info" : "neutral"}>{card.fit === "closer" ? "Closer fit" : "Loose fit"}</Chip>
                  </div>
                  <p className="text-sm text-muted">
                    RSI {card.rsi ?? "n/a"}
                    {card.rangePct !== null ? ` · range ${card.rangePct}%` : ""}
                  </p>
                  {card.callStrike !== null && card.putStrike !== null ? (
                    <p className="text-sm text-ink">Call near {formatPrice(card.callStrike)} · put near {formatPrice(card.putStrike)}</p>
                  ) : null}
                  <p className="text-sm leading-6 text-muted">{card.note}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
