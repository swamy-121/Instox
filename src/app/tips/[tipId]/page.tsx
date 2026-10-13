"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bookmark, Lock } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { ChangeText, Pill, SampleBadge, SidePill, StatusDot } from "@/components/design";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { apiFetch } from "@/lib/api-client";
import { CATEGORY_LABELS } from "@/lib/labels";
import { formatPrice } from "@/lib/money";
import { isSampleData } from "@/lib/market-session";
import type { OpenTipView, TipView } from "@/server/tips/present";

function isOpen(tip: TipView): tip is OpenTipView {
  return tip.locked === false;
}

export default function TipDetailPage() {
  return (
    <AppFrame>
      <Detail />
    </AppFrame>
  );
}

function Detail() {
  const params = useParams<{ tipId: string }>();
  const [tip, setTip] = useState<TipView | null>(null);
  const [quote, setQuote] = useState<{ last: number; changePct: number; freshnessStatus?: string; dataLabel?: string } | null>(null);
  const [error, setError] = useState<{ message: string; code: string; requestId?: string } | null>(null);

  function load() {
    setError(null);
    apiFetch<{ tip: TipView }>(`/api/v1/tips/${params.tipId}`).then((result) => {
      if (!result.ok) {
        setError({ message: result.message, code: result.code, requestId: result.requestId });
        return;
      }
      setTip(result.data.tip);
      apiFetch<{ records: Array<{ symbol: string; last: number; changePct: number; freshnessStatus?: string; dataLabel?: string }> }>("/api/v1/content/indices").then((market) => {
        if (!market.ok) return;
        const match = market.data.records.find((row) => row.symbol === result.data.tip.symbol);
        setQuote(match ?? null);
      });
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tipId]);

  if (error?.code === "FORBIDDEN" || error?.code === "ACCOUNT_DISABLED") return <PermissionDenied message={error.message} />;
  if (error) return <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />;
  if (!tip) return <LoadingState label="Loading tip" />;

  const reason = isOpen(tip) ? tip.closeReason : null;

  const sample = isSampleData(quote?.dataLabel, quote?.freshnessStatus === "live" ? true : quote ? false : undefined);
  const statusTone = reason === "target_hit" ? "up" : reason === "stop_loss_hit" ? "down" : tip.status === "published" ? "brand" : "neutral";
  const statusText = reason === "target_hit" ? "Target hit" : reason === "stop_loss_hit" ? "SL hit" : tip.status === "published" ? "Active" : tip.status === "expired" ? "Expired" : tip.status === "closed" ? "Closed" : tip.status;

  return (
    <article className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-5">
      <div>
        <section className="card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-ink">{tip.symbol}</h2>
              <SidePill side={tip.side} />
            </div>
            <StatusDot tone={statusTone}>{statusText}</StatusDot>
          </div>
          <p className="mt-0.5 text-[11px] text-muted">{CATEGORY_LABELS[tip.category]} · {tip.timeframe}</p>
          {quote ? (
            <p className="mt-3 flex items-baseline gap-2">
              <span className="num text-[26px] font-bold text-ink">{formatPrice(quote.last)}</span>
              <ChangeText last={quote.last} changePct={quote.changePct} />
            </p>
          ) : <p className="mt-3 text-sm text-muted">Price unavailable</p>}
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted">
              {quote?.freshnessStatus === "delayed" ? "Delayed" : quote?.freshnessStatus === "stale" ? "Stale" : quote?.freshnessStatus === "offline" ? "Offline" : "As published"}
              {" · "}
              {tip.updatedAt ? new Date(tip.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "no update time"}
            </p>
            {sample ? <SampleBadge /> : null}
          </div>
        </section>
        {tip.locked ? <PremiumLock /> : <OpenLevels tip={tip} />}
      </div>
      <div className="mt-3 lg:mt-0">
        <div className="flex flex-wrap gap-2">
          <LibraryButtons tipId={tip.id} />
          <WatchButton symbol={tip.symbol} />
        </div>
        <p className="mt-4 text-[11px] leading-5 text-muted">
          This is a research idea, not a guaranteed outcome. Market investments are subject to risk.
        </p>
      </div>
    </article>
  );
}

function LibraryButtons({ tipId }: { tipId: string }) {
  const [saved, setSaved] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ saved: boolean; tracked: boolean }>(`/api/v1/tips/${tipId}/library`).then((result) => {
      if (!result.ok) return;
      setSaved(result.data.saved);
      setTracked(result.data.tracked);
    });
  }, [tipId]);

  async function toggle(kind: "save" | "track") {
    const on = kind === "save" ? saved : tracked;
    const result = await apiFetch<{ saved?: boolean; tracked?: boolean }>(`/api/v1/tips/${tipId}/${kind}`, { method: on ? "DELETE" : "POST" });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (kind === "save") setSaved(Boolean(result.data.saved));
    else setTracked(Boolean(result.data.tracked));
    setMessage(kind === "save" ? (on ? "Removed from saved." : "Saved for later.") : (on ? "Stopped tracking." : "Tracking this idea."));
  }

  return (
    <div className="flex flex-1 flex-wrap gap-2">
      <button type="button" className="btn-secondary" onClick={() => void toggle("save")}>
        <Bookmark className="h-4 w-4" aria-hidden="true" />
        {saved ? "Saved" : "Save"}
      </button>
      <button type="button" className="btn-primary" onClick={() => void toggle("track")}>{tracked ? "Tracking" : "Track this tip"}</button>
      {message ? <p className="w-full text-sm text-muted" role="status">{message}</p> : null}
    </div>
  );
}

function WatchButton({ symbol }: { symbol: string }) {
  const [message, setMessage] = useState<string | null>(null);
  async function add() {
    const result = await apiFetch<{ symbol: string }>("/api/v1/watchlist", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    });
    setMessage(result.ok ? `${result.data.symbol} is on your watchlist.` : result.message);
  }
  return (
    <div className="mt-4">
      <button type="button" className="btn-secondary" onClick={() => void add()}>Add to watchlist</button>
      {message ? <p className="mt-2 text-sm text-muted" role="status">{message}</p> : null}
    </div>
  );
}

function PremiumLock() {
  return (
    <div className="relative mt-6 overflow-hidden rounded-card border border-line bg-white shadow-card">
      <div className="pointer-events-none select-none space-y-3 p-4 blur-md" aria-hidden="true">
        <div className="grid grid-cols-3 gap-2">
          <div className="h-16 rounded-xl bg-canvas" />
          <div className="h-16 rounded-xl bg-canvas" />
          <div className="h-16 rounded-xl bg-canvas" />
        </div>
        <div className="h-4 w-2/3 rounded bg-line" />
        <div className="h-4 w-1/2 rounded bg-line" />
        <div className="h-20 rounded-xl bg-canvas" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/75 px-6 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-lg font-semibold text-ink">Premium idea</h2>
        <p className="mt-1 max-w-xs text-sm leading-6 text-muted">
          Upgrade to Premium to see the entry, stop-loss, targets and full reasoning.
        </p>
        <Link href="/pricing" className="btn-primary mt-4">
          View plans
        </Link>
      </div>
    </div>
  );
}

function OpenLevels({ tip }: { tip: OpenTipView }) {
  const entry = tip.entryMax != null && tip.entryMax !== tip.entryMin ? `${formatPrice(tip.entryMin)} – ${formatPrice(tip.entryMax)}` : formatPrice(tip.entryMin);
  const rows: Array<[string, string, string]> = [
    ["Entry range", entry, "text-ink"],
    ["Stop-loss", formatPrice(tip.stopLoss), "text-loss"],
    ...tip.targets.map((target) => [target.label, formatPrice(target.price), "text-profit"] as [string, string, string]),
  ];
  return (
    <div className="mt-3 space-y-3">
      <section className="card !py-1">
        {rows.map(([label, value, tone], index) => (
          <div key={label} className={`flex items-center justify-between gap-3 py-3 ${index ? "border-t border-line" : ""}`}>
            <div>
              <p className="text-[13px] text-muted">{label}</p>
              <p className={`num text-base font-bold ${tone}`}>{value}</p>
            </div>
            <Pill>{label === "Stop-loss" ? "Level" : "Set"}</Pill>
          </div>
        ))}
      </section>
      {tip.optionType ? (
        <p className="text-sm text-muted">
          {tip.optionType} {tip.strikePrice} · expiry {tip.expiry} · lot {tip.lotSize}
        </p>
      ) : null}
      <section className="card">
        <h3 className="text-[15px] font-bold text-ink">Rationale</h3>
        <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6 text-[#33413A]">{tip.thesis}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">Published</dt>
            <dd className="text-[13px] font-semibold">{tip.publishedAt ? new Date(tip.publishedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "Not yet"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">Valid until</dt>
            <dd className="text-[13px] font-semibold">{tip.expiresAt ? new Date(tip.expiresAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "Not set"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">Last update</dt>
            <dd className="text-[13px] font-semibold">{new Date(tip.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">Disclosure</dt>
            <dd className="text-[13px] font-semibold">{tip.riskDisclosureVersion}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
