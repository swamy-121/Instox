import { desc } from "drizzle-orm";
import { createId } from "@/lib/ids";
import { getDb, type Database } from "@/server/db/client";
import { auditLogs } from "@/server/db/schema";

export type AuditInput = {
  actorUid: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  requestId: string;
  occurredAt?: string;
};

export type Executor = Pick<Database, "insert" | "select" | "update" | "delete">;

export function auditPayload(input: AuditInput) {
  return {
    id: createId("aud"),
    actorUid: input.actorUid,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    requestId: input.requestId,
  };
}

export async function insertAudit(db: Executor, input: AuditInput): Promise<string> {
  const payload = auditPayload(input);
  await db.insert(auditLogs).values(payload);
  return payload.id;
}

export async function recordAudit(input: AuditInput): Promise<string> {
  return insertAudit(getDb(), input);
}

export async function listAuditLogs(limit = 50) {
  return getDb().select().from(auditLogs).orderBy(desc(auditLogs.occurredAt)).limit(limit);
}
