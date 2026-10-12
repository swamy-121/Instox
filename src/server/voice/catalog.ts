export const VOICE_LANGUAGES = [
  { value: "te", label: "Telugu" },
  { value: "hi", label: "Hindi" },
  { value: "en", label: "English" },
] as const;

export const VOICE_OPTIONS = [
  { value: "anushka", label: "Anushka, warm neural" },
  { value: "vidya", label: "Vidya, calm neural" },
  { value: "abhilash", label: "Abhilash, steady neural" },
] as const;

export const CAMPAIGN_KINDS = [
  { value: "renewal_reminder", label: "Renewal reminder" },
  { value: "trial_followup", label: "Trial follow-up" },
  { value: "inbound_faq", label: "Inbound FAQ" },
] as const;

export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number]["value"];
export type VoiceId = (typeof VOICE_OPTIONS)[number]["value"];
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number]["value"];

export function isVoiceLanguage(value: string): value is VoiceLanguage {
  return VOICE_LANGUAGES.some((item) => item.value === value);
}

export function isVoiceId(value: string): value is VoiceId {
  return VOICE_OPTIONS.some((item) => item.value === value);
}

export function isCampaignKind(value: string): value is CampaignKind {
  return CAMPAIGN_KINDS.some((item) => item.value === value);
}

export const DEFAULT_VOICE_PROMPT = `You are Meera, a friendly person on the Instox team. You are on a phone call. Sound like a real person, warm and unhurried, never like a recording.

Use short sentences. One idea, then stop. Use small fillers the way people do: "hmm", "okay", "achha", "right". Leave a beat before the next thought.

If they speak Telugu, answer in simple spoken Telugu and mix in everyday English when that sounds natural. Words like plan, renewal, and trial can stay in English. If they speak Hindi or English, stay with them. Do not translate line by line.

Let them interrupt. The moment they speak, stop and listen. Ask one question, then wait.

You may remind them about a renewal, follow up on a trial, or answer a short question about Instox. Do not promise returns. A tip is not a reason to buy or sell. If you do not know, say so and offer a callback from the team.

Use their name when you have it. Before you hang up, check they are all set, then say goodbye.`;

export const DEFAULT_WELCOME = "Hi, this is Meera from Instox. Is this a good moment?";
