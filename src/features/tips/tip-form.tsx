"use client";

import { useEffect, useMemo, useState } from "react";
import instrumentFile from "../../../config/instruments.json";
import compliance from "../../../config/compliance.json";
import { CATEGORY_LABELS } from "@/lib/labels";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/money";
import { TIP_CATEGORIES, type TipCategory, type TipRecord, type TipSide } from "@/types/domain";

export type TipFormValue = {
  symbol: string;
  category: TipCategory;
  side: TipSide;
  entryMin: string;
  entryMax: string;
  stopLoss: string;
  t1: string;
  t2: string;
  t3: string;
  optionType: "" | "CE" | "PE";
  strikePrice: string;
  expiry: string;
  underlying: string;
  lotSize: string;
  timeframe: string;
  thesis: string;
  accessTier: "free" | "premium";
};

export type ListingIntent = "draft" | "published";

export function emptyTipForm(): TipFormValue {
  return {
    symbol: "",
    category: "equity",
    side: "BUY",
    entryMin: "",
    entryMax: "",
    stopLoss: "",
    t1: "",
    t2: "",
    t3: "",
    optionType: "",
    strikePrice: "",
    expiry: "",
    underlying: "",
    lotSize: "",
    timeframe: "",
    thesis: "",
    accessTier: "free",
  };
}

export function formFromTip(tip: TipRecord): TipFormValue {
  return {
    symbol: tip.symbol,
    category: tip.category,
    side: tip.side,
    entryMin: String(tip.entryMin),
    entryMax: tip.entryMax == null ? "" : String(tip.entryMax),
    stopLoss: String(tip.stopLoss),
    t1: tip.targets.find((target) => target.label === "T1")?.price.toString() ?? "",
    t2: tip.targets.find((target) => target.label === "T2")?.price.toString() ?? "",
    t3: tip.targets.find((target) => target.label === "T3")?.price.toString() ?? "",
    optionType: tip.optionType ?? "",
    strikePrice: tip.strikePrice == null ? "" : String(tip.strikePrice),
    expiry: tip.expiry ?? "",
    underlying: tip.underlying ?? "",
    lotSize: tip.lotSize == null ? "" : String(tip.lotSize),
    timeframe: tip.timeframe,
    thesis: tip.thesis,
    accessTier: tip.accessTier,
  };
}

function num(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function toTipPayload(form: TipFormValue) {
  const targets = [
    { label: "T1" as const, price: num(form.t1) },
    { label: "T2" as const, price: num(form.t2) },
    { label: "T3" as const, price: num(form.t3) },
  ].filter((target) => target.price !== null);
  return {
    symbol: form.symbol,
    category: form.category,
    side: form.side,
    entryMin: num(form.entryMin),
    entryMax: num(form.entryMax),
    stopLoss: num(form.stopLoss),
    targets,
    optionType: form.category === "options" ? form.optionType || null : null,
    strikePrice: form.category === "options" ? num(form.strikePrice) : null,
    expiry: form.category === "options" || form.category === "futures" ? form.expiry || null : null,
    underlying: form.category === "options" ? form.underlying || null : null,
    lotSize: form.category === "options" ? num(form.lotSize) : null,
    timeframe: form.timeframe || "1-5 sessions",
    thesis: form.thesis,
    riskDisclosureVersion: compliance.riskDisclosureVersion,
    accessTier: form.category === "penny_stocks" ? "premium" : form.accessTier,
  };
}

export function TipForm({
  initial,
  fields,
  busy,
  submitLabel,
  showListing = false,
  onCancel,
  onSubmit,
}: {
  initial: TipFormValue;
  fields?: Record<string, string>;
  busy?: boolean;
  submitLabel: string;
  showListing?: boolean;
  onCancel?: () => void;
  onSubmit: (form: TipFormValue, listing: ListingIntent) => void;
}) {
  const [form, setForm] = useState(initial);
  const [listing, setListing] = useState<ListingIntent>("published");
  const [quotes, setQuotes] = useState<Record<string, number>>({});
  const instruments = instrumentFile.instruments.filter((item) => item.eligible);
  const tier = form.category === "penny_stocks" ? "premium" : form.accessTier;
  const fieldError = useMemo(() => fields ?? {}, [fields]);

  useEffect(() => {
    apiFetch<{ records: Array<{ symbol: string; last: number }> }>("/api/v1/content/indices").then((result) => {
      if (!result.ok) return;
      const next: Record<string, number> = {};
      for (const row of result.data.records) next[row.symbol] = row.last;
      setQuotes(next);
    });
  }, []);

  function set<K extends keyof TipFormValue>(key: K, value: TipFormValue[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const ltp = quotes[form.symbol];

  return (
    <form
      className="card space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ ...form, accessTier: tier }, showListing ? listing : "draft");
      }}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label>
          <span className="label">Symbol</span>
          <select className="field" value={form.symbol} onChange={(event) => set("symbol", event.target.value)} required>
            <option value="">Select symbol</option>
            {instruments.map((item) => (
              <option key={item.symbol} value={item.symbol}>{item.symbol}</option>
            ))}
          </select>
          {fieldError.symbol ? <span className="text-sm text-ink">{fieldError.symbol}</span> : null}
        </label>
        <label>
          <span className="label">Type</span>
          <select className="field" value={form.side} onChange={(event) => set("side", event.target.value as TipSide)}>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </label>
        <label>
          <span className="label">Category</span>
          <select className="field" value={form.category} onChange={(event) => set("category", event.target.value as TipCategory)}>
            {TIP_CATEGORIES.map((category) => (
              <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Entry Price</span>
          <input className="field tabular-nums" inputMode="decimal" value={form.entryMin} onChange={(event) => set("entryMin", event.target.value)} required />
          {fieldError.entryMin ? <span className="text-sm text-ink">{fieldError.entryMin}</span> : null}
        </label>
        {(["t1", "t2", "t3"] as const).map((key, index) => (
          <label key={key}>
            <span className="label">Target {index + 1} ({key.toUpperCase()})</span>
            <input className="field tabular-nums" inputMode="decimal" value={form[key]} onChange={(event) => set(key, event.target.value)} />
          </label>
        ))}
        <label>
          <span className="label">Stop Loss (SL)</span>
          <input className="field tabular-nums" inputMode="decimal" value={form.stopLoss} onChange={(event) => set("stopLoss", event.target.value)} required />
          {fieldError.stopLoss ? <span className="text-sm text-ink">{fieldError.stopLoss}</span> : null}
        </label>
        <label>
          <span className="label">LTP</span>
          <input className="field tabular-nums" readOnly value={ltp == null ? "" : formatPrice(ltp)} placeholder="From stored quotes" />
        </label>
        <label>
          <span className="label">Expiry</span>
          <input className="field" type="date" value={form.expiry} onChange={(event) => set("expiry", event.target.value)} />
          {fieldError.expiry ? <span className="text-sm text-ink">{fieldError.expiry}</span> : null}
        </label>
        <label>
          <span className="label">CE / PE</span>
          <select className="field" value={form.optionType} onChange={(event) => set("optionType", event.target.value as TipFormValue["optionType"])}>
            <option value="">Select</option>
            <option value="CE">CE</option>
            <option value="PE">PE</option>
          </select>
          {fieldError.optionType ? <span className="text-sm text-ink">{fieldError.optionType}</span> : null}
        </label>
        <label>
          <span className="label">Strike Price</span>
          <input className="field tabular-nums" inputMode="decimal" value={form.strikePrice} onChange={(event) => set("strikePrice", event.target.value)} />
          {fieldError.strikePrice ? <span className="text-sm text-ink">{fieldError.strikePrice}</span> : null}
        </label>
        {form.category === "options" ? (
          <>
            <label>
              <span className="label">Underlying</span>
              <input className="field" value={form.underlying} onChange={(event) => set("underlying", event.target.value)} />
              {fieldError.underlying ? <span className="text-sm text-ink">{fieldError.underlying}</span> : null}
            </label>
            <label>
              <span className="label">Lot size</span>
              <input className="field" inputMode="numeric" value={form.lotSize} onChange={(event) => set("lotSize", event.target.value)} />
              {fieldError.lotSize ? <span className="text-sm text-ink">{fieldError.lotSize}</span> : null}
            </label>
          </>
        ) : null}
      </div>
      {fieldError.targets ? <p className="text-sm text-ink">{fieldError.targets}</p> : null}
      <label className="block">
        <span className="label">Timeframe</span>
        <input className="field" value={form.timeframe} onChange={(event) => set("timeframe", event.target.value)} />
        {fieldError.timeframe ? <span className="text-sm text-ink">{fieldError.timeframe}</span> : null}
      </label>
      <label className="block">
        <span className="flex items-center justify-between">
          <span className="label mb-0">Write-up</span>
          <span className="text-xs tabular-nums text-muted">{form.thesis.length}/2000</span>
        </span>
        <textarea className="field mt-1.5 min-h-32" maxLength={2000} value={form.thesis} onChange={(event) => set("thesis", event.target.value)} placeholder="What members should read with this idea" />
        {fieldError.thesis ? <span className="text-sm text-ink">{fieldError.thesis}</span> : null}
      </label>
      <fieldset>
        <legend className="label">Visibility</legend>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-ink">
          <label className="flex items-center gap-2">
            <input type="radio" name="visibility" checked={tier === "premium"} onChange={() => set("accessTier", "premium")} />
            Premium Only
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="visibility" checked={tier === "free"} disabled={form.category === "penny_stocks"} onChange={() => set("accessTier", "free")} />
            Free for All
          </label>
        </div>
      </fieldset>
      {showListing ? (
        <label className="block max-w-xs">
          <span className="label">Status</span>
          <select className="field" value={listing} onChange={(event) => setListing(event.target.value as ListingIntent)}>
            <option value="published">Active</option>
            <option value="draft">Draft</option>
          </select>
        </label>
      ) : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Saving" : submitLabel}
        </button>
      </div>
    </form>
  );
}
