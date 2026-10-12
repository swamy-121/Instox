"use client";

import { useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { Pill } from "@/components/admin-ui";
import { OperationsGate } from "@/components/operations-gate";
import { ContentDesk } from "@/features/admin/content-desk";
import { apiFetch } from "@/lib/api-client";

const BOOLS = [
  { value: "false", label: "No" },
  { value: "true", label: "Yes" },
];

export default function AdminPlansPage() {
  return (
    <AppFrame admin>
      <OperationsGate>
        <ContentDesk
          collection="plans"
          title="Plans"
          lede="Edit name, price, features, and the popular flag. Leave Approved off until the price is cleared. A verified payment grants premium only when the plan is approved."
          addLabel="Add plan"
          columns={[
            { key: "name", label: "Name" },
            { key: "billingPeriod", label: "Period" },
            { key: "priceMinor", label: "Paise" },
            { key: "approved", label: "Approved", render: (row) => <Pill tone={row.approved === true ? "green" : "gray"}>{row.approved === true ? "Approved" : "Unapproved"}</Pill> },
            { key: "listed", label: "Listed", render: (row) => <Pill tone={row.listed === true ? "teal" : "gray"}>{row.listed === true ? "Listed" : "Hidden"}</Pill> },
          ]}
          fields={[
            { key: "name", label: "Name", kind: "text" },
            { key: "billingPeriod", label: "Billing period", kind: "select", options: [
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
              { value: "none", label: "None" },
            ] },
            { key: "priceMinor", label: "Price in paise", kind: "number" },
            { key: "accessDays", label: "Access days", kind: "number" },
            { key: "currency", label: "Currency", kind: "text" },
            { key: "effectiveFrom", label: "Effective from", kind: "text" },
            { key: "taxTreatment", label: "Tax treatment", kind: "text" },
            { key: "active", label: "Active", kind: "select", options: BOOLS },
            { key: "approved", label: "Approved", kind: "select", options: BOOLS },
            { key: "listed", label: "Listed", kind: "select", options: BOOLS },
            { key: "mostPopular", label: "Most popular", kind: "select", options: BOOLS },
            { key: "placeholder", label: "Placeholder", kind: "select", options: BOOLS },
            { key: "description", label: "Description", kind: "textarea" },
            { key: "features", label: "Features, one per line", kind: "textarea" },
          ]}
          blank={() => ({
            id: "",
            name: "",
            description: "",
            priceMinor: "0",
            currency: "INR",
            billingPeriod: "monthly",
            features: "",
            active: "true",
            approved: "false",
            effectiveFrom: new Date().toISOString(),
            taxTreatment: "unapproved",
            placeholder: "true",
            accessDays: "30",
            listed: "false",
            mostPopular: "false",
          })}
          fromRow={(row) => ({
            id: String(row.id ?? ""),
            name: String(row.name ?? ""),
            description: String(row.description ?? ""),
            priceMinor: String(row.priceMinor ?? 0),
            currency: String(row.currency ?? "INR"),
            billingPeriod: String(row.billingPeriod ?? "monthly"),
            features: Array.isArray(row.features) ? row.features.map(String).join("\n") : "",
            active: row.active === false ? "false" : "true",
            approved: row.approved === true ? "true" : "false",
            effectiveFrom: String(row.effectiveFrom ?? new Date().toISOString()),
            taxTreatment: String(row.taxTreatment ?? "unapproved"),
            placeholder: row.placeholder === false ? "false" : "true",
            accessDays: String(row.accessDays ?? 30),
            listed: row.listed === true ? "true" : "false",
            mostPopular: row.mostPopular === true ? "true" : "false",
          })}
          toPayload={(form) => ({
            id: form.id || slug(form.name),
            name: form.name,
            description: form.description,
            priceMinor: Number(form.priceMinor),
            currency: form.currency || "INR",
            billingPeriod: form.billingPeriod,
            features: form.features.split("\n").map((line) => line.trim()).filter(Boolean),
            active: form.active === "true",
            approved: form.approved === "true",
            effectiveFrom: form.effectiveFrom,
            taxTreatment: form.taxTreatment || "unapproved",
            placeholder: form.placeholder !== "false",
            accessDays: Number(form.accessDays),
            listed: form.listed === "true",
            mostPopular: form.mostPopular === "true",
          })}
        />
        <GrantForm />
      </OperationsGate>
    </AppFrame>
  );
}

function GrantForm() {
  const [uid, setUid] = useState("");
  const [planId, setPlanId] = useState("premium_monthly");
  const [days, setDays] = useState("30");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function change(action: "grant" | "revoke") {
    const result = await apiFetch<{ message?: string }>("/api/v1/admin/entitlements", {
      method: "POST",
      body: JSON.stringify({ uid, action, planId, days: Number(days), reason }),
    });
    setMessage(result.ok ? result.data.message ?? `Entitlement ${action} recorded.` : result.message);
  }

  return (
    <form
      className="card mt-4 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void change("grant");
      }}
    >
      <h2 className="font-semibold text-ink">Manual grant or revoke</h2>
      <p className="text-sm text-muted">A manual grant is audited and is not a payment. It does not approve the plan price.</p>
      <input className="field" placeholder="User id" value={uid} onChange={(event) => setUid(event.target.value)} />
      <input className="field" placeholder="Plan id" value={planId} onChange={(event) => setPlanId(event.target.value)} />
      <input className="field" placeholder="Days" value={days} onChange={(event) => setDays(event.target.value)} />
      <input className="field" placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
      <div className="flex gap-2">
        <button className="btn-primary" type="submit">Grant</button>
        <button className="btn-secondary" type="button" onClick={() => void change("revoke")}>Revoke</button>
      </div>
      {message ? <p className="text-sm" role="status">{message}</p> : null}
    </form>
  );
}

function slug(value: string): string {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  return base || `plan_${Date.now().toString(36)}`;
}
