import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AppError } from "@/lib/errors";

export type CipherBlob = {
  iv: string;
  tag: string;
  data: string;
};

export function integrationKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (trimmed.length < 16) {
    throw new AppError(503, "PROVIDER_UNAVAILABLE", "Set INTEGRATIONS_ENC_KEY before saving integration secrets.");
  }
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return Buffer.from(trimmed, "hex");
  const decoded = Buffer.from(trimmed, "base64");
  if (decoded.length === 32 && /^[A-Za-z0-9+/]+=*$/.test(trimmed)) return decoded;
  return createHash("sha256").update(trimmed).digest();
}

export function encryptSecret(plain: string, key: Buffer): CipherBlob {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

export function decryptSecret(blob: CipherBlob, key: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(blob.data, "base64")), decipher.final()]);
  return plain.toString("utf8");
}

/** Last four characters only. Short values stay fully hidden. */
export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

export function isCipherBlob(value: unknown): value is CipherBlob {
  if (!value || typeof value !== "object") return false;
  const blob = value as CipherBlob;
  return typeof blob.iv === "string" && typeof blob.tag === "string" && typeof blob.data === "string";
}
