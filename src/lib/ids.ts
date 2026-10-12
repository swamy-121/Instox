import { randomBytes } from "node:crypto";

export function createId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export function createRequestId(): string {
  return `req_${randomBytes(8).toString("hex")}`;
}
