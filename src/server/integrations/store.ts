import { AppError } from "@/lib/errors";
import { decryptSecret, encryptSecret, integrationKey, isCipherBlob, maskSecret, type CipherBlob } from "@/server/integrations/crypto";
import { INTEGRATION_FIELDS, integrationField, validFieldValue, type IntegrationField } from "@/server/integrations/fields";
import { getDb } from "@/server/db/client";
import { integrationSecrets } from "@/server/db/schema";

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
  const rows = await getDb().select().from(integrationSecrets);
  const stored: Record<string, string | null> = {};
  const key = readKey();
  for (const row of rows) {
    const blob = { iv: row.iv, tag: row.tag, data: row.data };
    if (!isCipherBlob(blob)) continue;
    if (!INTEGRATION_FIELDS.some((field) => field.key === row.fieldKey)) continue;
    if (!key) {
      stored[row.fieldKey] = null;
      continue;
    }
    try {
      stored[row.fieldKey] = decryptSecret(blob, key);
    } catch {
      stored[row.fieldKey] = null;
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
  const db = getDb();
  const now = new Date().toISOString();
  const currentRows = await db.select().from(integrationSecrets);
  const secrets: Record<string, CipherBlob> = {};
  for (const row of currentRows) {
    const blob = { iv: row.iv, tag: row.tag, data: row.data };
    if (isCipherBlob(blob)) secrets[row.fieldKey] = blob;
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
  await db.delete(integrationSecrets);
  const entries = Object.entries(secrets);
  if (entries.length > 0) {
    await db.insert(integrationSecrets).values(
      entries.map(([fieldKey, blob]) => ({
        fieldKey,
        iv: blob.iv,
        tag: blob.tag,
        data: blob.data,
        updatedBy: input.updatedBy,
        updatedAt: now,
      })),
    );
  }
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
