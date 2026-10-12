"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTitle, Pill } from "@/components/admin-ui";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { canManageCrm } from "@/server/authorization/roles";
import { CAMPAIGN_KINDS, DEFAULT_VOICE_PROMPT, VOICE_LANGUAGES, VOICE_OPTIONS, type CampaignKind, type VoiceId, type VoiceLanguage } from "@/server/voice/catalog";

type Call = { id: string; status: string; durationSeconds: number | null; simulated: boolean; transcript: string | null };
type Campaign = {
  id: string;
  name: string;
  kind: CampaignKind;
  language: VoiceLanguage;
  voice: VoiceId;
  prompt: string;
  calls: Call[];
};

export default function VoicePage() {
  return (
    <AppFrame admin>
      <VoiceCampaigns />
    </AppFrame>
  );
}

function VoiceCampaigns() {
  const { state } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Renewal check-in");
  const [kind, setKind] = useState<CampaignKind>("renewal_reminder");
  const [language, setLanguage] = useState<VoiceLanguage>("te");
  const [voice, setVoice] = useState<VoiceId>("anushka");
  const [prompt, setPrompt] = useState(DEFAULT_VOICE_PROMPT);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    apiFetch<{ campaigns: Campaign[] }>("/api/v1/admin/voice/campaigns").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setCampaigns(result.data.campaigns);
    });
  }

  useEffect(() => {
    if (state.status === "ready") load();
  }, [state.status]);

  if (state.status === "ready" && !canManageCrm(state.me.roles)) {
    return <PermissionDenied message="Voice campaigns are limited to support and administrators." />;
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const result = editing
      ? await apiFetch("/api/v1/admin/voice/campaigns", { method: "PATCH", body: JSON.stringify({ id: editing, name, kind, language, voice, prompt }) })
      : await apiFetch("/api/v1/admin/voice/campaigns", { method: "POST", body: JSON.stringify({ name, kind, language, voice, prompt }) });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setEditing(null);
    setMessage(editing ? "Campaign updated." : "Campaign saved.");
    load();
  }

  async function start(id: string) {
    setMessage(null);
    const result = await apiFetch<{ placed: number; provider: string }>(`/api/v1/admin/voice/campaigns/${id}/start`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage(result.data.provider === "dev"
      ? `Simulated ${result.data.placed} call${result.data.placed === 1 ? "" : "s"}. The transcript is on the customer.`
      : `Queued ${result.data.placed} call${result.data.placed === 1 ? "" : "s"} with ${result.data.provider}.`);
    load();
  }

  return (
    <div className="space-y-4">
      <AdminTitle
        title="Voice"
        lede="Bolna speaks Telugu, Hindi, and English with a natural voice. People can interrupt. With no key, calls are simulated into the CRM."
      />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!campaigns && !error ? <LoadingState label="Loading campaigns" /> : null}
      {message ? <p className="text-sm text-ink" role="status">{message}</p> : null}
      <ul className="space-y-3">
        {campaigns?.map((campaign) => (
          <li key={campaign.id} className="card space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-ink">{campaign.name}</h2>
              <Pill>{CAMPAIGN_KINDS.find((item) => item.value === campaign.kind)?.label ?? campaign.kind}</Pill>
            </div>
            <p className="text-sm text-muted">{VOICE_LANGUAGES.find((item) => item.value === campaign.language)?.label} · {VOICE_OPTIONS.find((item) => item.value === campaign.voice)?.label}</p>
            <p className="text-sm text-muted">{campaign.calls.length} call{campaign.calls.length === 1 ? "" : "s"}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => void start(campaign.id)}>Start calls</button>
              <button
                type="button"
                className="btn-quiet"
                onClick={() => {
                  setEditing(campaign.id);
                  setName(campaign.name);
                  setKind(campaign.kind);
                  setLanguage(campaign.language);
                  setVoice(campaign.voice);
                  setPrompt(campaign.prompt);
                }}
              >
                Edit script
              </button>
            </div>
          </li>
        ))}
      </ul>
      <form className="card space-y-3" onSubmit={(event) => void create(event)}>
        <h2 className="text-base font-semibold text-ink">{editing ? "Edit campaign" : "New campaign"}</h2>
        <label className="block">
          <span className="label">Name</span>
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block">
          <span className="label">Type</span>
          <select className="field" value={kind} onChange={(event) => setKind(event.target.value as CampaignKind)}>
            {CAMPAIGN_KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Language</span>
          <select className="field" value={language} onChange={(event) => setLanguage(event.target.value as VoiceLanguage)}>
            {VOICE_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Voice</span>
          <select className="field" value={voice} onChange={(event) => setVoice(event.target.value as VoiceId)}>
            {VOICE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Script</span>
          <textarea className="field min-h-48" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </label>
        <button className="btn-primary" type="submit">{editing ? "Save script" : "Create campaign"}</button>
      </form>
    </div>
  );
}
