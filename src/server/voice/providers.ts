import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { DEFAULT_VOICE_PROMPT, DEFAULT_WELCOME, type VoiceId, type VoiceLanguage } from "@/server/voice/catalog";

export type VoiceCallRequest = {
  callId: string;
  to: string;
  name: string;
  language: VoiceLanguage;
  voice: VoiceId;
  prompt: string;
  campaignName: string;
  webhookUrl: string | null;
};

export type VoiceCallResult = {
  provider: "dev" | "bolna" | "vapi";
  providerCallId: string;
  providerAgentId?: string;
  status: "queued" | "completed";
  durationSeconds?: number;
  recordingUrl?: string | null;
  transcript?: string | null;
  simulated: boolean;
};

export type VoiceProvider = {
  id: VoiceCallResult["provider"];
  placeCall(input: VoiceCallRequest): Promise<VoiceCallResult>;
};

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const VAPI_VOICES: Record<VoiceId, string> = {
  anushka: "Neha",
  vidya: "Kylie",
  abhilash: "Rohan",
};

export function buildBolnaAgent(input: VoiceCallRequest): Record<string, unknown> {
  const prompt = input.prompt.trim() || DEFAULT_VOICE_PROMPT;
  return {
    agent_config: {
      agent_name: input.campaignName.slice(0, 80) || "Instox",
      agent_welcome_message: DEFAULT_WELCOME,
      ...(input.webhookUrl ? { webhook_url: input.webhookUrl } : {}),
      tasks: [
        {
          task_type: "conversation",
          toolchain: { execution: "sequential", pipelines: [["transcriber", "llm", "synthesizer"]] },
          tools_config: {
            llm_agent: {
              agent_type: "simple_llm_agent",
              agent_flow_type: "streaming",
              llm_config: { provider: "openai", model: "gpt-4.1-mini", max_tokens: 120, temperature: 0.7 },
            },
            synthesizer: {
              provider: "sarvam",
              provider_config: {
                voice: input.voice,
                voice_id: input.voice,
                model: "bulbul:v3",
                language: input.language,
              },
              stream: true,
              buffer_size: 150,
              audio_format: "wav",
            },
            transcriber: {
              provider: "sarvam",
              model: "saaras:v4",
              language: input.language,
              stream: true,
              encoding: "linear16",
              sampling_rate: 16000,
              endpointing: 200,
            },
            input: { provider: "plivo", format: "wav" },
            output: { provider: "plivo", format: "wav" },
          },
          task_config: {
            hangup_after_silence: 12,
            incremental_delay: 250,
            number_of_words_for_interruption: 2,
            backchanneling: true,
            backchanneling_message_gap: 4,
            backchanneling_start_delay: 3,
            call_terminate: 180,
          },
        },
      ],
    },
    agent_prompts: { task_1: { system_prompt: prompt } },
  };
}

export function buildVapiCall(input: VoiceCallRequest, phoneNumberId: string): Record<string, unknown> {
  const prompt = input.prompt.trim() || DEFAULT_VOICE_PROMPT;
  return {
    assistant: {
      name: "Meera",
      firstMessage: DEFAULT_WELCOME,
      model: {
        provider: "openai",
        model: "gpt-4.1-mini",
        temperature: 0.7,
        maxTokens: 120,
        messages: [{ role: "system", content: prompt }],
      },
      voice: { provider: "vapi", voiceId: VAPI_VOICES[input.voice] },
      transcriber: { provider: "deepgram", model: "nova-3", language: input.language === "en" ? "en" : input.language },
      startSpeakingPlan: { waitSeconds: 0.15 },
      stopSpeakingPlan: { numWords: 1, voiceSeconds: 0.2 },
      backgroundDenoisingEnabled: true,
      recordingEnabled: true,
      ...(input.webhookUrl
        ? { server: { url: input.webhookUrl }, serverMessages: ["end-of-call-report", "status-update"] }
        : {}),
    },
    phoneNumberId,
    customer: { number: input.to, name: input.name },
  };
}

export function devVoiceProvider(): VoiceProvider {
  return {
    id: "dev",
    async placeCall(input) {
      const name = input.name || "there";
      return {
        provider: "dev",
        providerCallId: createId("sim"),
        status: "completed",
        durationSeconds: 36,
        recordingUrl: null,
        simulated: true,
        transcript: `Meera: Hi ${name}, this is Meera from Instox. Is this a good moment?\n${name}: Hmm, yes, tell me quickly.\nMeera: Okay. I just wanted to check in. Achha, does that make sense?\n${name}: Right, that is fine.\nMeera: Lovely. I will let you go.`,
      };
    },
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function bolnaVoiceProvider(apiKey: string, fetchImpl: FetchLike = fetch): VoiceProvider {
  return {
    id: "bolna",
    async placeCall(input) {
      const created = await fetchImpl("https://api.bolna.ai/v2/agent", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(buildBolnaAgent(input)),
        signal: AbortSignal.timeout(12000),
      });
      const agent = await readJson(created);
      if (created.status === 401) throw new AppError(503, "PROVIDER_UNAVAILABLE", "Bolna rejected the API key.");
      if (!created.ok) throw new AppError(503, "PROVIDER_UNAVAILABLE", "Bolna could not prepare the caller.");
      const agentId = String(agent.agent_id ?? agent.id ?? "");
      if (!agentId) throw new AppError(503, "PROVIDER_UNAVAILABLE", "Bolna did not return an agent.");
      const dialed = await fetchImpl("https://api.bolna.ai/call", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          recipient_phone_number: input.to,
          user_data: { instoxCallId: input.callId },
        }),
        signal: AbortSignal.timeout(12000),
      });
      const call = await readJson(dialed);
      if (dialed.status === 401) throw new AppError(503, "PROVIDER_UNAVAILABLE", "Bolna rejected the API key.");
      if (!dialed.ok) throw new AppError(503, "PROVIDER_UNAVAILABLE", "Bolna could not place the call.");
      const providerCallId = String(call.execution_id ?? call.call_id ?? call.id ?? "");
      if (!providerCallId) throw new AppError(503, "PROVIDER_UNAVAILABLE", "Bolna did not return a call id.");
      return { provider: "bolna", providerCallId, providerAgentId: agentId, status: "queued", simulated: false };
    },
  };
}

export function vapiVoiceProvider(apiKey: string, phoneNumberId: string, fetchImpl: FetchLike = fetch): VoiceProvider {
  return {
    id: "vapi",
    async placeCall(input) {
      if (!phoneNumberId) throw new AppError(503, "PROVIDER_UNAVAILABLE", "Save a Vapi phone number id before placing a call.");
      const response = await fetchImpl("https://api.vapi.ai/call", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(buildVapiCall(input, phoneNumberId)),
        signal: AbortSignal.timeout(12000),
      });
      const body = await readJson(response);
      if (response.status === 401) throw new AppError(503, "PROVIDER_UNAVAILABLE", "Vapi rejected the API key.");
      if (!response.ok) throw new AppError(503, "PROVIDER_UNAVAILABLE", "Vapi could not place the call.");
      const providerCallId = String(body.id ?? "");
      if (!providerCallId) throw new AppError(503, "PROVIDER_UNAVAILABLE", "Vapi did not return a call id.");
      return { provider: "vapi", providerCallId, status: "queued", simulated: false };
    },
  };
}
