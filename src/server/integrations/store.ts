import { AppError } from "@/lib/errors";
import { decryptSecret, encryptSecret, integrationKey, isCipherBlob, maskSecret, type CipherBlob } from "@/server/integrations/crypto";
import { INTEGRATION_FIELDS, integrationField, validFieldValue, type IntegrationField } from "@/server/integrations/fields";
import { adminDb } from "@/server/db/admin";

export type SecretSource = "stored" | "env" | "missing" | "unreadable";

export type ResolvedField = {
  key: string;
  source: SecretSource;
  value: string;
};

type EnvLike = Record<string, string | undefined>;

type Cache = {
  expires: number;
  fields: Record<string, ResolvedField>;
};

const DOC = "integrations";
let cache: Cache | null = null;

export function resetIntegrationCache(): void {
  cache = null;
}

export function runtimeEnv(base: EnvLike = process.env): EnvLike {
  const env: EnvLike = { ...base };
  if (!cache) return env;
  for (const field of INTEGRATION_FIELDS) {
    const resolved = cache.fields[field.key];
    if (!resolved) continue;
    if (resolved.source === "stored") env[field.key] = resolved.value;
    if (resolved.source === "unreadable") env[field.key] = "";
  }
  return env;
}

export function resolveFields(stored: Record<string, string | null>, env: EnvLike): Record<string, ResolvedField> {
  const fields: Record<string, ResolvedField> = {};
  for (const field of INTEGRATION_FIELDS) {
    const saved = stored[field.key];
    if (saved === null) {
      fields[field.key] = { key: field.key, source: "unreadable", value: "" };
      continue;
    }
    if (saved !== undefined) {
      fields[field.key] = { key: field.key, source: "stored", value: saved };
      continue;
    }
    const fromEnv = env[field.key] ?? "";
    fields[field.key] = fromEnv
      ? { key: field.key, source: "env", value: fromEnv }
      : { key: field.key, source: "missing", value: "" };
  }
  return fields;
}

function readKey(): Buffer | null {
  const raw = process.env.INTEGRATIONS_ENC_KEY ?? "";
  if (raw.trim().length < 16) return null;
  return integrationKey(raw);
}

async function readStored(): Promise<Record<string, string | null>> {
  const snap = await adminDb().collection("appConfig").doc(DOC).get();
  const secrets = snap.data()?.secrets;
  const stored: Record<string, string | null> = {};
  if (!secrets || typeof secrets !== "object") return stored;
  const key = readKey();
  for (const field of INTEGRATION_FIELDS) {
    const blob = (secrets as Record<string, unknown>)[field.key];
    if (!isCipherBlob(blob)) continue;
    if (!key) {
      stored[field.key] = null;
      continue;
    }
    try {
      stored[field.key] = decryptSecret(blob, key);
    } catch {
      stored[field.key] = null;
    }
  }
  return stored;
}

export async function refreshIntegrations(force = false): Promise<Record<string, ResolvedField>> {
  if (!force && cache && cache.expires > Date.now()) return cache.fields;
  if (process.env.VITEST && !process.env.FIRESTORE_EMULATOR_HOST) {
    const fields = resolveFields({}, process.env);
    cache = { expires: Date.now() + 15_000, fields };
    return fields;
  }
  try {
    const stored = await readStored();
    const fields = resolveFields(stored, process.env);
    cache = { expires: Date.now() + 15_000, fields };
    return fields;
  } catch {
    const fields = resolveFields({}, process.env);
    cache = { expires: Date.now() + 5_000, fields };
    return fields;
  }
}

export function fieldViews(fields: Record<string, ResolvedField>): Array<{
  key: string;
  group: string;
  label: string;
  secret: boolean;
  options?: string[];
  source: SecretSource;
  masked: string;
  value?: string;
}> {
  return INTEGRATION_FIELDS.map((field) => {
    const resolved = fields[field.key] ?? { key: field.key, source: "missing" as const, value: "" };
    return {
      key: field.key,
      group: field.group,
      label: field.label,
      secret: field.secret,
      options: field.options,
      source: resolved.source,
      masked: field.secret ? maskSecret(resolved.value) : "",
      value: field.secret ? undefined : resolved.value,
    };
  });
}

export async function saveIntegrationFields(input: {
  values: Record<string, string>;
  clear: string[];
  updatedBy: string;
}): Promise<Record<string, ResolvedField>> {
  const key = readKey();
  if (!key) {
    throw new AppError(503, "PROVIDER_UNAVAILABLE", "Set INTEGRATIONS_ENC_KEY before saving integration secrets.");
  }
  for (const [name, value] of Object.entries(input.values)) {
    const field = integrationField(name);
    if (!field || !validFieldValue(field, value)) {
      throw new AppError(400, "VALIDATION_ERROR", "Check the integration fields.", { form: "Use the listed choices and keep each value under 500 characters." });
    }
  }
  for (const name of input.clear) {
    if (!integrationField(name)) {
      throw new AppError(400, "VALIDATION_ERROR", "Check the integration fields.", { form: "Unknown field." });
    }
  }
  const ref = adminDb().collection("appConfig").doc(DOC);
  const snap = await ref.get();
  const current = (snap.data()?.secrets ?? {}) as Record<string, CipherBlob>;
  const secrets: Record<string, CipherBlob> = {};
  for (const field of INTEGRATION_FIELDS) {
    if (isCipherBlob(current[field.key])) secrets[field.key] = current[field.key];
  }
  for (const name of input.clear) delete secrets[name];
  for (const [name, value] of Object.entries(input.values)) {
    const field = integrationField(name);
    if (!value && field?.secret) {
      delete secrets[name];
      continue;
    }
    secrets[name] = encryptSecret(value, key);
  }
  await ref.set(
    {
      secrets,
      updatedBy: input.updatedBy,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  return refreshIntegrations(true);
}

export function groupFields(group: IntegrationField["group"], fields: Record<string, ResolvedField>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of INTEGRATION_FIELDS) {
    if (field.group !== group) continue;
    values[field.key] = fields[field.key]?.value ?? "";
  }
  return values;
}
