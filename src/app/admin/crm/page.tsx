"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTitle, Pill } from "@/components/admin-ui";
import { ListBar, ListPager, useListQuery } from "@/components/list-bar";
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
      <Suspense fallback={<LoadingState label="Loading CRM" />}>
        <CrmList />
      </Suspense>
    </AppFrame>
  );
}

function CrmList() {
  const { state } = useAuth();
  const list = useListQuery();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [plans, setPlans] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const stage = list.search.get("stage") ?? "";
  const plan = list.search.get("plan") ?? "";
  const trialEnding = list.search.get("trialEnding") === "1";
  const churned = list.search.get("churned") === "1";

  function load() {
    apiFetch<{ contacts: Contact[]; plans: string[]; total: number }>(`/api/v1/admin/crm?${list.queryString(["stage", "plan", "trialEnding", "churned", "q", "kind", "tag", "from", "to"])}`).then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setContacts(result.data.contacts);
      setPlans(result.data.plans);
      setTotal(result.data.total);
    });
  }

  useEffect(() => {
    if (state.status === "ready") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, list.search]);

  if (state.status === "ready" && !canManageCrm(state.me.roles)) {
    return <PermissionDenied message="CRM is limited to support and administrators." />;
  }

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
        <StageButton active={stage === ""} onClick={() => list.set({ stage: null, churned: null })} label="All" />
        {CRM_STAGES.map((item) => (
          <StageButton key={item} active={stage === item} onClick={() => list.set({ stage: item, churned: null })} label={CRM_STAGE_LABELS[item]} />
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">Plan</span>
          <select className="field w-40" value={plan} aria-label="Plan" onChange={(event) => list.set({ plan: event.target.value })}>
            <option value="">Any plan</option>
            {plans.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Kind</span>
          <select className="field w-36" value={list.search.get("kind") ?? ""} aria-label="Kind" onChange={(event) => list.set({ kind: event.target.value })}>
            <option value="">Lead or customer</option>
            <option value="lead">Lead</option>
            <option value="customer">Customer</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2 pb-2 text-sm text-ink">
          <input type="checkbox" checked={trialEnding} onChange={(event) => list.set({ trialEnding: event.target.checked ? "1" : null })} />
          Trial ending
        </label>
        <label className="inline-flex items-center gap-2 pb-2 text-sm text-ink">
          <input type="checkbox" checked={churned} onChange={(event) => list.set({ churned: event.target.checked ? "1" : null, stage: event.target.checked ? "churned" : stage || null })} />
          Churned
        </label>
      </div>
      <ListBar placeholder="Name, phone, or tag" showDates fields={["tag"]} extra={
        <label>
          <span className="label">Tag</span>
          <input className="field w-36" name="tag" key={list.search.get("tag") ?? ""} defaultValue={list.search.get("tag") ?? ""} placeholder="renewal" aria-label="Tag" />
        </label>
      } />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!contacts && !error ? <LoadingState label="Loading CRM" /> : null}
      {contacts && contacts.length === 0 ? <EmptyState title="No people" body="Add a lead, or the member list will appear here after the first load." /> : null}
      {contacts && contacts.length > 0 ? (
        <>
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
        </>
      ) : null}
      {contacts ? <ListPager total={total} page={list.page} pageSize={list.pageSize} /> : null}
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
    <button type="button" role="tab" aria-selected={active} className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-primary text-white" : "border border-line bg-white text-ink"}`} onClick={onClick}>
      {label}
    </button>
  );
}
