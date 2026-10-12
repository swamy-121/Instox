import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { GET as getCrm } from "@/app/api/v1/admin/crm/route";
import { createSession } from "@/server/auth/session";
import { createLead } from "@/server/crm/repo";
import { migrationSql, setDb, type Database } from "@/server/db/client";
import { userRoles, users, voiceCalls } from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { DEFAULT_VOICE_PROMPT } from "@/server/voice/catalog";
import { buildBolnaAgent, buildVapiCall } from "@/server/voice/providers";
import { applyVoiceWebhook, createCampaign, parseBolnaWebhook, parseVapiWebhook, startCampaign } from "@/server/voice/service";

let client: PGlite;
let memberToken = "";
let supportToken = "";

function call(path: string, token: string): Request {
  return new Request(`http://localhost${path}`, { headers: { host: "localhost", origin: "http://localhost", cookie: `instox_session=${token}` } });
}

beforeAll(async () => {
  process.env.SESSION_SECRET = "test-session-secret-value";
  delete process.env.BOLNA_API_KEY;
  delete process.env.VAPI_API_KEY;
  delete process.env.VOICE_PROVIDER;
  client = new PGlite();
  await client.exec(migrationSql());
  const db = drizzle(client, { schema });
  setDb(db as unknown as Database);
  const now = "2026-10-11T00:00:00.000Z";
  await db.insert(users).values([
    {
      id: "member_crm",
      displayName: "Member",
      status: "active",
      locale: "en-IN",
      timezone: "Asia/Kolkata",
      providers: ["phone"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "support_crm",
      displayName: "Support",
      status: "active",
      locale: "en-IN",
      timezone: "Asia/Kolkata",
      providers: ["phone"],
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await db.insert(userRoles).values([
    { userId: "member_crm", roles: ["member"], grantedBy: "test", grantedAt: now, updatedAt: now },
    { userId: "support_crm", roles: ["support"], grantedBy: "test", grantedAt: now, updatedAt: now },
  ]);
  memberToken = await createSession("member_crm", 3600);
  supportToken = await createSession("support_crm", 3600);
}, 60_000);

afterAll(async () => {
  await client.close();
});

describe("crm and voice", () => {
  it("lets support open the CRM and refuses a member", async () => {
    expect((await getCrm(call("/api/v1/admin/crm", memberToken))).status).toBe(403);
    const allowed = await getCrm(call("/api/v1/admin/crm", supportToken));
    expect(allowed.status).toBe(200);
    const body = await allowed.json();
    expect(body.data.contacts.some((row: { name: string }) => row.name === "Support")).toBe(true);
  });

  it("builds a natural Bolna caller and a Vapi caller that can be interrupted", () => {
    const request = {
      callId: "call_1",
      to: "+919000000006",
      name: "Free Member",
      language: "te" as const,
      voice: "anushka" as const,
      prompt: DEFAULT_VOICE_PROMPT,
      campaignName: "Trial follow-up",
      webhookUrl: "https://instox.example/api/v1/webhooks/voice/bolna?token=secret",
    };
    const bolna = buildBolnaAgent(request);
    const task = ((bolna.agent_config as { tasks: Array<Record<string, unknown>> }).tasks)[0];
    const taskConfig = task.task_config as { number_of_words_for_interruption: number; incremental_delay: number };
    const tools = task.tools_config as { transcriber: { language: string }; synthesizer: { provider: string; provider_config: { model: string; language: string } } };
    expect(taskConfig.number_of_words_for_interruption).toBe(2);
    expect(taskConfig.incremental_delay).toBeLessThanOrEqual(400);
    expect(tools.transcriber.language).toBe("te");
    expect(tools.synthesizer.provider).toBe("sarvam");
    expect(tools.synthesizer.provider_config.model).toBe("bulbul:v3");
    expect(tools.synthesizer.provider_config.language).toBe("te");
    expect(JSON.stringify(bolna)).toContain("short sentences");
    expect(JSON.stringify(bolna)).not.toContain("BOLNA_API_KEY");

    const vapi = buildVapiCall(request, "phone_1");
    const assistant = vapi.assistant as { stopSpeakingPlan: { numWords: number }; startSpeakingPlan: { waitSeconds: number }; serverMessages: string[] };
    expect(assistant.stopSpeakingPlan.numWords).toBe(1);
    expect(assistant.startSpeakingPlan.waitSeconds).toBeLessThanOrEqual(0.2);
    expect(assistant.serverMessages).toContain("end-of-call-report");
  });

  it("simulates a call into the CRM when no voice key is set", async () => {
    const contactId = await createLead({ name: "Trial Lead", phone: "+919811110000", authorId: "support_crm" });
    const campaignId = await createCampaign({
      name: "Trial follow-up",
      kind: "trial_followup",
      language: "te",
      voice: "anushka",
      prompt: DEFAULT_VOICE_PROMPT,
      authorId: "support_crm",
    });
    const started = await startCampaign(campaignId, [contactId], null);
    expect(started.provider).toBe("dev");
    expect(started.placed).toBe(1);
    const db = drizzle(client, { schema });
    const calls = await db.select().from(voiceCalls).where(eq(voiceCalls.contactId, contactId));
    expect(calls[0]?.simulated).toBe(true);
    expect(calls[0]?.transcript).toContain("Meera");
    expect(calls[0]?.status).toBe("completed");
  });

  it("reads Bolna and Vapi webhooks into the call log", async () => {
    const bolna = parseBolnaWebhook({
      id: "exec_1",
      status: "completed",
      conversation_duration: 42.2,
      recording_url: "https://cdn.example/call.wav",
      transcript: "Meera: Hi\nLead: Achha, okay",
      user_data: { instoxCallId: "call_missing" },
    });
    expect(bolna?.durationSeconds).toBe(42);
    expect(bolna?.recordingUrl).toContain("call.wav");
    const vapi = parseVapiWebhook({
      message: {
        type: "end-of-call-report",
        startedAt: "2026-10-12T10:00:00.000Z",
        endedAt: "2026-10-12T10:01:00.000Z",
        call: { id: "vapi_1", status: "ended" },
        artifact: { transcript: "Hello", recordingUrl: "https://cdn.example/vapi.wav" },
      },
    });
    expect(vapi?.durationSeconds).toBe(60);
    expect(vapi?.status).toBe("completed");
    const db = drizzle(client, { schema });
    const [existing] = await db.select().from(voiceCalls).limit(1);
    expect(existing).toBeTruthy();
    await db.update(voiceCalls).set({ provider: "bolna", providerCallId: "exec_1" }).where(eq(voiceCalls.id, existing.id));
    expect(await applyVoiceWebhook(bolna!)).toBe(true);
    const [updated] = await db.select().from(voiceCalls).where(eq(voiceCalls.id, existing.id));
    expect(updated.transcript).toContain("Achha");
    expect(updated.recordingUrl).toBe("https://cdn.example/call.wav");
    expect(updated.durationSeconds).toBe(42);
  });
});
