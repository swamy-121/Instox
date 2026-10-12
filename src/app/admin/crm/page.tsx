"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTitle, Pill } from "@/components/admin-ui";
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { canManageCrm } from "@/server/authorization/roles";
import { CRM_STAGES, CRM_STAGE_LABELS, type CrmStage } from "@/server/crm/model";

type Contact = {
  id: string;
  kind: string;
  name: string;
  phone: string | null;
  stage: string;
  planId: string | null;
  renewalAt: string | null;
  trialEndsAt: string | null;
  tags: string[];
};

export default function CrmPage() {
  return (
    <AppFrame admin>
      <CrmList />
    </AppFrame>
  );
}

function CrmList() {
  const { state } = useAuth();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"" | CrmStage>("");
  const [plan, setPlan] = useState("");
  const [trialEnding, setTrialEnding] = useState(false);
  const [churned, setChurned] = useState(false);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    const params = new URLSearchParams();
    if (stage) params.set("stage", stage);
    if (plan) params.set("plan", plan);
    if (trialEnding) params.set("trialEnding", "1");
    if (churned) params.set("churned", "1");
    if (q.trim()) params.set("q", q.trim());
    apiFetch<{ contacts: Contact[] }>(`/api/v1/admin/crm?${params.toString()}`).then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setContacts(result.data.contacts);
    });
  }

  useEffect(() => {
    if (state.status === "ready") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, stage, plan, trialEnding, churned]);

  if (state.status === "ready" && !canManageCrm(state.me.roles)) {
    return <PermissionDenied message="CRM is limited to support and administrators." />;
  }

  const plans = [...new Set((contacts ?? []).map((row) => row.planId).filter((item): item is string => Boolean(item)))];

  async function addLead(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const result = await apiFetch<{ id: string }>("/api/v1/admin/crm", {
      method: "POST",
      body: JSON.stringify({ name, phone }),
    });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setName("");
    setPhone("");
    setMessage("Lead added.");
    load();
  }

  return (
    <div className="space-y-4">
      <AdminTitle title="CRM" lede="Leads and customers, with the pipeline New, Contacted, Trial, Paid, and Churned." />
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Pipeline">
        <StageButton active={stage === ""} onClick={() => setStage("")} label="All" />
        {CRM_STAGES.map((item) => (
          <StageButton key={item} active={stage === item} onClick={() => { setStage(item); setChurned(false); }} label={CRM_STAGE_LABELS[item]} />
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">Plan</span>
          <select className="field" value={plan} onChange={(event) => setPlan(event.target.value)}>
            <option value="">Any plan</option>
            {plans.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={trialEnding} onChange={(event) => setTrialEnding(event.target.checked)} />
          Trial ending
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={churned} onChange={(event) => { setChurned(event.target.checked); if (event.target.checked) setStage("churned"); }} />
          Churned
        </label>
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); load(); }}>
          <input className="field" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name or phone" aria-label="Search CRM" />
          <button className="btn-secondary" type="submit">Search</button>
        </form>
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!contacts && !error ? <LoadingState label="Loading CRM" /> : null}
      {contacts && contacts.length === 0 ? <EmptyState title="No people" body="Add a lead, or the member list will appear here after the first load." /> : null}
      {contacts && contacts.length > 0 ? (
        <ul className="space-y-2">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <Link href={`/admin/crm/${contact.id}`} className="card flex items-center justify-between gap-3">
                <span>
                  <span className="block font-medium text-ink">{contact.name}</span>
                  <span className="text-xs text-muted">{contact.phone ?? "No phone"} · {contact.planId ?? "No plan"}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {contact.tags.slice(0, 2).map((tag) => <Pill key={tag}>{tag}</Pill>)}
                  <Pill tone={contact.stage === "churned" ? "red" : contact.stage === "paid" ? "green" : "gray"}>
                    {CRM_STAGE_LABELS[contact.stage as CrmStage] ?? contact.stage}
                  </Pill>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <form className="card space-y-3" onSubmit={(event) => void addLead(event)}>
        <h2 className="text-base font-semibold text-ink">Add a lead</h2>
        <label className="block">
          <span className="label">Name</span>
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block">
          <span className="label">Phone</span>
          <input className="field" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="10 digit mobile" />
        </label>
        {message ? <p className="text-sm text-ink" role="status">{message}</p> : null}
        <button className="btn-primary" type="submit">Add lead</button>
      </form>
    </div>
  );
}

function StageButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="tab" aria-selected={active} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${active ? "bg-primary text-white" : "bg-white text-ink ring-1 ring-line"}`} onClick={onClick}>
      {label}
    </button>
  );
}
