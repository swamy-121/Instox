import { createId } from "@/lib/ids";
import { adminDb } from "@/server/db/admin";
import type { Firestore, Transaction } from "firebase-admin/firestore";

export type AuditInput = {
  actorUid: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  requestId: string;
  occurredAt?: string;
};

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

export function writeAudit(tx: Transaction, db: Firestore, input: AuditInput): string {
  const payload = auditPayload(input);
  tx.set(db.collection("adminAuditLogs").doc(payload.id), payload);
  return payload.id;
}

export async function recordAudit(input: AuditInput): Promise<string> {
  const db = adminDb();
  const payload = auditPayload(input);
  await db.collection("adminAuditLogs").doc(payload.id).set(payload);
  return payload.id;
}
