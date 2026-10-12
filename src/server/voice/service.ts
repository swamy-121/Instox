import { timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { inDateRange } from "@/lib/list-page";
import { addActivity, contactsForCampaign } from "@/server/crm/repo";
import { getDb } from "@/server/db/client";
import { crmContacts, voiceCalls, voiceCampaigns } from "@/server/db/schema";
import { refreshIntegrations, runtimeEnv } from "@/server/integrations/store";
import { isCampaignKind, isVoiceId, isVoiceLanguage, type CampaignKind, type VoiceId, type VoiceLanguage } from "@/server/voice/catalog";
import { bolnaVoiceProvider, devVoiceProvider, vapiVoiceProvider, type VoiceProvider } from "@/server/voice/providers";

export function resolveVoiceProvider(fetchImpl?: typeof fetch): VoiceProvider {
  const env = runtimeEnv();
  const choice = (env.VOICE_PROVIDER ?? "").trim();
  const bolnaKey = (env.BOLNA_API_KEY ?? "").trim();
  const vapiKey = (env.VAPI_API_KEY ?? "").trim();
  const vapiPhone = (env.VAPI_PHONE_NUMBER_ID ?? "").trim();
  if (choice === "dev") return devVoiceProvider();
  if (choice === "bolna" || (!choice && bolnaKey)) {
    if (!bolnaKey) throw new AppError(503, "PROVIDER_UNAVAILABLE", "Save a Bolna API key, or leave the provider on dev.");
    return bolnaVoiceProvider(bolnaKey, fetchImpl);
  }
  if (choice === "vapi" || (!choice && vapiKey)) {
    if (!vapiKey) throw new AppError(503, "PROVIDER_UNAVAILABLE", "Save a Vapi API key, or leave the provider on dev.");
    return vapiVoiceProvider(vapiKey, vapiPhone, fetchImpl);
  }
  return devVoiceProvider();
}

export async function createCampaign(input: {
  name: string;
  kind: string;
  language: string;
  voice: string;
  prompt: string;
  authorId: string;
}): Promise<string> {
  if (!isCampaignKind(input.kind)) throw new AppError(400, "VALIDATION_ERROR", "Choose a campaign type.", { kind: "Unknown type." });
  if (!isVoiceLanguage(input.language)) throw new AppError(400, "VALIDATION_ERROR", "Choose Telugu, Hindi, or English.", { language: "Unknown language." });
  if (!isVoiceId(input.voice)) throw new AppError(400, "VALIDATION_ERROR", "Choose a voice.", { voice: "Unknown voice." });
  const name = input.name.trim();
  const prompt = input.prompt.trim();
  if (name.length < 2) throw new AppError(400, "VALIDATION_ERROR", "Name the campaign.", { name: "Enter a name." });
  if (prompt.length < 40) throw new AppError(400, "VALIDATION_ERROR", "Write a longer script.", { prompt: "The script needs at least a short paragraph." });
  const id = createId("camp");
  const now = new Date().toISOString();
  await getDb().insert(voiceCampaigns).values({
    id,
    name,
    kind: input.kind,
    language: input.language,
    voice: input.voice,
    prompt,
    providerAgentId: null,
    createdBy: input.authorId,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateCampaign(
  id: string,
  patch: { prompt?: string; language?: string; voice?: string; name?: string; kind?: string },
): Promise<void> {
  const rows = await getDb().select().from(voiceCampaigns).where(eq(voiceCampaigns.id, id)).limit(1);
  if (!rows[0]) throw new AppError(404, "NOT_FOUND", "That campaign does not exist.");
  const next: Partial<typeof voiceCampaigns.$inferInsert> = { updatedAt: new Date().toISOString() };
  if (patch.name !== undefined) {
    if (patch.name.trim().length < 2) throw new AppError(400, "VALIDATION_ERROR", "Name the campaign.", { name: "Enter a name." });
    next.name = patch.name.trim();
  }
  if (patch.prompt !== undefined) {
    if (patch.prompt.trim().length < 40) throw new AppError(400, "VALIDATION_ERROR", "Write a longer script.", { prompt: "The script needs at least a short paragraph." });
    next.prompt = patch.prompt.trim();
  }
  if (patch.language !== undefined) {
    if (!isVoiceLanguage(patch.language)) throw new AppError(400, "VALIDATION_ERROR", "Choose Telugu, Hindi, or English.", { language: "Unknown language." });
    next.language = patch.language;
  }
  if (patch.voice !== undefined) {
    if (!isVoiceId(patch.voice)) throw new AppError(400, "VALIDATION_ERROR", "Choose a voice.", { voice: "Unknown voice." });
    next.voice = patch.voice;
  }
  if (patch.kind !== undefined) {
    if (!isCampaignKind(patch.kind)) throw new AppError(400, "VALIDATION_ERROR", "Choose a campaign type.", { kind: "Unknown type." });
    next.kind = patch.kind;
  }
  await getDb().update(voiceCampaigns).set(next).where(eq(voiceCampaigns.id, id));
}

export async function listCampaigns() {
  const db = getDb();
  const campaigns = await db.select().from(voiceCampaigns).orderBy(desc(voiceCampaigns.createdAt));
  const calls = await db.select().from(voiceCalls).orderBy(desc(voiceCalls.createdAt)).limit(100);
  return campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    kind: campaign.kind as CampaignKind,
    language: campaign.language as VoiceLanguage,
    voice: campaign.voice as VoiceId,
    prompt: campaign.prompt,
    createdAt: campaign.createdAt,
    calls: calls
      .filter((call) => call.campaignId === campaign.id)
      .map(presentCall),
  }));
}

export async function listCalls(filter: { status?: string; q?: string; from?: string | null; to?: string | null }) {
  const db = getDb();
  const [calls, contacts] = await Promise.all([
    db.select().from(voiceCalls).orderBy(desc(voiceCalls.createdAt)),
    db.select({ id: crmContacts.id, name: crmContacts.name, phone: crmContacts.phone }).from(crmContacts),
  ]);
  const byId = new Map(contacts.map((row) => [row.id, row]));
  const query = filter.q?.trim().toLowerCase() ?? "";
  return calls
    .map((row) => {
      const contact = byId.get(row.contactId);
      return { ...presentCall(row), name: contact?.name ?? "", phone: contact?.phone ?? null };
    })
    .filter((row) => {
      if (filter.status && row.status !== filter.status) return false;
      if (!inDateRange(row.createdAt, filter.from ?? null, filter.to ?? null)) return false;
      if (!query) return true;
      return `${row.name} ${row.phone ?? ""} ${row.provider} ${row.status}`.toLowerCase().includes(query);
    });
}

function presentCall(row: typeof voiceCalls.$inferSelect) {
  return {
    id: row.id,
    contactId: row.contactId,
    provider: row.provider,
    status: row.status,
    durationSeconds: row.durationSeconds,
    recordingUrl: row.recordingUrl,
    transcript: row.transcript,
    simulated: row.simulated,
    createdAt: row.createdAt,
  };
}

export async function startCampaign(id: string, contactIds: string[] | undefined, baseUrl: string | null): Promise<{ placed: number; skipped: number; provider: string }> {
  await refreshIntegrations();
  const db = getDb();
  const rows = await db.select().from(voiceCampaigns).where(eq(voiceCampaigns.id, id)).limit(1);
  const campaign = rows[0];
  if (!campaign) throw new AppError(404, "NOT_FOUND", "That campaign does not exist.");
  const provider = resolveVoiceProvider();
  const targets = contactIds?.length
    ? await selectedContacts(contactIds)
    : await contactsForCampaign(campaign.kind);
  if (campaign.kind === "inbound_faq" && !contactIds?.length) {
    return { placed: 0, skipped: 0, provider: provider.id };
  }
  const secret = (runtimeEnv().VOICE_WEBHOOK_SECRET ?? "").trim();
  const webhookUrl = baseUrl && secret ? `${baseUrl.replace(/\/$/, "")}/api/v1/webhooks/voice/${provider.id}?token=${encodeURIComponent(secret)}` : null;
  let placed = 0;
  let skipped = 0;
  for (const contact of targets) {
    if (!contact.phone) {
      skipped += 1;
      continue;
    }
    const callId = createId("call");
    const now = new Date().toISOString();
    const result = await provider.placeCall({
      callId,
      to: contact.phone,
      name: contact.name,
      language: campaign.language as VoiceLanguage,
      voice: campaign.voice as VoiceId,
      prompt: campaign.prompt,
      campaignName: campaign.name,
      webhookUrl: provider.id === "dev" ? null : webhookUrl,
    });
    await db.insert(voiceCalls).values({
      id: callId,
      campaignId: campaign.id,
      contactId: contact.id,
      provider: result.provider,
      providerCallId: result.providerCallId,
      status: result.status,
      durationSeconds: result.durationSeconds ?? null,
      recordingUrl: result.recordingUrl ?? null,
      transcript: result.transcript ?? null,
      simulated: result.simulated,
      startedAt: now,
      endedAt: result.status === "completed" ? now : null,
      createdAt: now,
      updatedAt: now,
    });
    if (result.providerAgentId) {
      await db.update(voiceCampaigns).set({ providerAgentId: result.providerAgentId, updatedAt: now }).where(eq(voiceCampaigns.id, campaign.id));
    }
    const summary = result.simulated
      ? `Simulated call completed in ${result.durationSeconds ?? 0}s.`
      : `Call queued with ${result.provider}.`;
    await addActivity(contact.id, "call", summary);
    placed += 1;
  }
  return { placed, skipped, provider: provider.id };
}

async function selectedContacts(ids: string[]): Promise<Array<{ id: string; name: string; phone: string | null }>> {
  const db = getDb();
  const rows = [];
  for (const id of ids.slice(0, 25)) {
    const found = await db.select().from(crmContacts).where(eq(crmContacts.id, id)).limit(1);
    if (found[0]) rows.push({ id: found[0].id, name: found[0].name, phone: found[0].phone });
  }
  return rows;
}

export type VoiceWebhookUpdate = {
  provider: "bolna" | "vapi";
  providerCallId: string;
  instoxCallId?: string;
  status: string;
  durationSeconds?: number | null;
  recordingUrl?: string | null;
  transcript?: string | null;
};

export function parseBolnaWebhook(body: unknown): VoiceWebhookUpdate | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const providerCallId = String(record.id ?? record.execution_id ?? "");
  if (!providerCallId) return null;
  const userData = record.user_data as Record<string, unknown> | undefined;
  const telephony = record.telephony_data as Record<string, unknown> | undefined;
  const duration = numberOrNull(record.conversation_duration) ?? numberOrNull(telephony?.duration);
  return {
    provider: "bolna",
    providerCallId,
    instoxCallId: typeof userData?.instoxCallId === "string" ? userData.instoxCallId : undefined,
    status: mapStatus(String(record.status ?? "")),
    durationSeconds: duration,
    recordingUrl: typeof record.recording_url === "string" ? record.recording_url : null,
    transcript: typeof record.transcript === "string" ? record.transcript : null,
  };
}

export function parseVapiWebhook(body: unknown): VoiceWebhookUpdate | null {
  if (!body || typeof body !== "object") return null;
  const message = (body as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const record = message as Record<string, unknown>;
  const type = String(record.type ?? "");
  const call = record.call as Record<string, unknown> | undefined;
  const providerCallId = String(call?.id ?? "");
  if (!providerCallId) return null;
  if (type === "status-update") {
    return { provider: "vapi", providerCallId, status: mapStatus(String(record.status ?? call?.status ?? "")) };
  }
  if (type !== "end-of-call-report") return { provider: "vapi", providerCallId, status: mapStatus(String(call?.status ?? "completed")) };
  const artifact = record.artifact as Record<string, unknown> | undefined;
  const recording = artifact?.recording as Record<string, unknown> | undefined;
  const started = Date.parse(String(record.startedAt ?? ""));
  const ended = Date.parse(String(record.endedAt ?? ""));
  const duration = Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, Math.round((ended - started) / 1000)) : null;
  return {
    provider: "vapi",
    providerCallId,
    status: "completed",
    durationSeconds: duration,
    recordingUrl: typeof artifact?.recordingUrl === "string" ? artifact.recordingUrl : typeof recording?.url === "string" ? recording.url : null,
    transcript: typeof artifact?.transcript === "string" ? artifact.transcript : null,
  };
}

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed));
}

function mapStatus(value: string): string {
  const status = value.toLowerCase();
  if (status === "completed" || status === "ended" || status === "call-disconnected") return status === "call-disconnected" ? "in_progress" : "completed";
  if (status.includes("no-answer") || status.includes("no_answer") || status === "busy") return "no_answer";
  if (status.includes("fail") || status === "error" || status === "canceled" || status === "stopped") return "failed";
  if (status.includes("ring")) return "ringing";
  if (status.includes("progress") || status === "in-progress") return "in_progress";
  if (status.includes("queue") || status === "initiated" || status === "scheduled") return "queued";
  return "in_progress";
}

export function webhookSecretMatches(presented: string, expected: string): boolean {
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function applyVoiceWebhook(update: VoiceWebhookUpdate): Promise<boolean> {
  const db = getDb();
  const byProvider = update.providerCallId
    ? await db
        .select()
        .from(voiceCalls)
        .where(and(eq(voiceCalls.provider, update.provider), eq(voiceCalls.providerCallId, update.providerCallId)))
        .limit(1)
    : [];
  const byId = !byProvider[0] && update.instoxCallId
    ? await db.select().from(voiceCalls).where(eq(voiceCalls.id, update.instoxCallId)).limit(1)
    : [];
  const row = byProvider[0] ?? byId[0];
  if (!row) return false;
  const now = new Date().toISOString();
  const terminal = update.status === "completed" || update.status === "failed" || update.status === "no_answer";
  await db
    .update(voiceCalls)
    .set({
      status: update.status,
      durationSeconds: update.durationSeconds ?? row.durationSeconds,
      recordingUrl: update.recordingUrl ?? row.recordingUrl,
      transcript: update.transcript ?? row.transcript,
      endedAt: terminal ? now : row.endedAt,
      updatedAt: now,
      providerCallId: row.providerCallId ?? update.providerCallId,
    })
    .where(eq(voiceCalls.id, row.id));
  if (terminal && row.status !== update.status) {
    const bits = [`Call ${update.status.replaceAll("_", " ")}.`];
    if (update.durationSeconds != null) bits.push(`${update.durationSeconds}s.`);
    await addActivity(row.contactId, "call", bits.join(" "));
  }
  return true;
}
