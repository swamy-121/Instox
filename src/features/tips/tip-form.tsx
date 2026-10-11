"use client";

import { useMemo, useState } from "react";
import instrumentFile from "../../../config/instruments.json";
import compliance from "../../../config/compliance.json";
import { CATEGORY_LABELS } from "@/lib/labels";
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

export function emptyTipForm(): TipFormValue {
  return {
    symbol: "RELIANCE",
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
    timeframe: form.timeframe,
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
  onSubmit,
}: {
  initial: TipFormValue;
  fields?: Record<string, string>;
  busy?: boolean;
  submitLabel: string;
  onSubmit: (form: TipFormValue) => void;
}) {
  const [form, setForm] = useState(initial);
  const instruments = instrumentFile.instruments.filter((item) => item.eligible);
  const showDerivative = form.category === "futures" || form.category === "options";
  const tier = form.category === "penny_stocks" ? "premium" : form.accessTier;
  const fieldError = useMemo(() => fields ?? {}, [fields]);

  function set<K extends keyof TipFormValue>(key: K, value: TipFormValue[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ ...form, accessTier: tier });
      }}
    >
      <p className="text-xs text-muted">{instrumentFile.label}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className="label">Symbol</span>
          <select className="field" value={form.symbol} onChange={(event) => set("symbol", event.target.value)}>
            {instruments.map((item) => (
              <option key={item.symbol} value={item.symbol}>{item.symbol}</option>
            ))}
          </select>
          {fieldError.symbol ? <span className="text-sm text-danger">{fieldError.symbol}</span> : null}
        </label>
        <label>
          <span className="label">Category</span>
          <select className="field" value={form.category} onChange={(event) => set("category", event.target.value as TipCategory)}>
            {TIP_CATEGORIES.map((category) => (
              <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
            ))}
          </select>
          {fieldError.category ? <span className="text-sm text-danger">{fieldError.category}</span> : null}
        </label>
        <label>
          <span className="label">Side</span>
          <select className="field" value={form.side} onChange={(event) => set("side", event.target.value as TipSide)}>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </label>
        <label>
          <span className="label">Access</span>
          <select className="field" value={tier} disabled={form.category === "penny_stocks"} onChange={(event) => set("accessTier", event.target.value as "free" | "premium")}>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
        </label>
        <label>
          <span className="label">Entry</span>
          <input className="field tabular-nums" inputMode="decimal" value={form.entryMin} onChange={(event) => set("entryMin", event.target.value)} />
          {fieldError.entryMin ? <span className="text-sm text-danger">{fieldError.entryMin}</span> : null}
        </label>
        <label>
          <span className="label">Entry max, optional</span>
          <input className="field tabular-nums" inputMode="decimal" value={form.entryMax} onChange={(event) => set("entryMax", event.target.value)} />
          {fieldError.entryMax ? <span className="text-sm text-danger">{fieldError.entryMax}</span> : null}
        </label>
        <label>
          <span className="label">Stop loss</span>
          <input className="field tabular-nums" inputMode="decimal" value={form.stopLoss} onChange={(event) => set("stopLoss", event.target.value)} />
          {fieldError.stopLoss ? <span className="text-sm text-danger">{fieldError.stopLoss}</span> : null}
        </label>
        <label>
          <span className="label">Timeframe</span>
          <input className="field" value={form.timeframe} onChange={(event) => set("timeframe", event.target.value)} />
          {fieldError.timeframe ? <span className="text-sm text-danger">{fieldError.timeframe}</span> : null}
        </label>
        {(["t1", "t2", "t3"] as const).map((key) => (
          <label key={key}>
            <span className="label">{key.toUpperCase()}</span>
            <input className="field tabular-nums" inputMode="decimal" value={form[key]} onChange={(event) => set(key, event.target.value)} />
          </label>
        ))}
      </div>
      {fieldError.targets ? <p className="text-sm text-danger">{fieldError.targets}</p> : null}
      {showDerivative ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label>
            <span className="label">Expiry</span>
            <input className="field" placeholder="YYYY-MM-DD" value={form.expiry} onChange={(event) => set("expiry", event.target.value)} />
            {fieldError.expiry ? <span className="text-sm text-danger">{fieldError.expiry}</span> : null}
          </label>
          {form.category === "options" ? (
            <>
              <label>
                <span className="label">Option type</span>
                <select className="field" value={form.optionType} onChange={(event) => set("optionType", event.target.value as TipFormValue["optionType"])}>
                  <option value="">Choose</option>
                  <option value="CE">CE</option>
                  <option value="PE">PE</option>
                </select>
                {fieldError.optionType ? <span className="text-sm text-danger">{fieldError.optionType}</span> : null}
              </label>
              <label>
                <span className="label">Strike</span>
                <input className="field" value={form.strikePrice} onChange={(event) => set("strikePrice", event.target.value)} />
                {fieldError.strikePrice ? <span className="text-sm text-danger">{fieldError.strikePrice}</span> : null}
              </label>
              <label>
                <span className="label">Underlying</span>
                <input className="field" value={form.underlying} onChange={(event) => set("underlying", event.target.value)} />
                {fieldError.underlying ? <span className="text-sm text-danger">{fieldError.underlying}</span> : null}
              </label>
              <label>
                <span className="label">Lot size</span>
                <input className="field" value={form.lotSize} onChange={(event) => set("lotSize", event.target.value)} />
                {fieldError.lotSize ? <span className="text-sm text-danger">{fieldError.lotSize}</span> : null}
              </label>
            </>
          ) : null}
        </div>
      ) : null}
      <label>
        <span className="label">Rationale</span>
        <textarea className="field min-h-32" value={form.thesis} onChange={(event) => set("thesis", event.target.value)} />
        {fieldError.thesis ? <span className="text-sm text-danger">{fieldError.thesis}</span> : null}
      </label>
      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? "Saving" : submitLabel}
      </button>
    </form>
  );
}
