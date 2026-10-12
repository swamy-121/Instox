import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { normalizePhone } from "@/server/auth/credentials";
import { isCrmStage, type CrmStage } from "@/server/crm/model";
import { getDb } from "@/server/db/client";
import {
  crmActivities,
  crmContacts,
  crmNotes,
  crmReminders,
  entitlements,
  paymentOrders,
  subscriptions,
  users,
  voiceCalls,
} from "@/server/db/schema";

const TRIAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function stageFromAccount(subscriptionStatus: string | null, entitlementStatus: string | null): CrmStage {
  if (subscriptionStatus === "cancelled" || subscriptionStatus === "expired" || subscriptionStatus === "refunded") return "churned";
  if (entitlementStatus === "active" || entitlementStatus === "grace" || subscriptionStatus === "active") return "paid";
  return "new";
}

export async function syncMemberContacts(): Promise<void> {
  const db = getDb();
  const [people, subs, plans, existing] = await Promise.all([
    db.select().from(users),
    db.select().from(subscriptions),
    db.select().from(entitlements),
    db.select({ userId: crmContacts.userId }).from(crmContacts).where(isNotNull(crmContacts.userId)),
  ]);
  const known = new Set(existing.map((row) => row.userId));
  const subByUser = new Map(subs.map((row) => [row.userId, row]));
  const planByUser = new Map(plans.map((row) => [row.userId, row]));
  const now = nowIso();
  const fresh = people.filter((person) => !known.has(person.id));
  if (fresh.length === 0) return;
  await db.insert(crmContacts).values(
    fresh.map((person) => {
      const sub = subByUser.get(person.id);
      const plan = planByUser.get(person.id);
      return {
        id: createId("crm"),
        userId: person.id,
        kind: "customer" as const,
        name: person.displayName || "Member",
        phone: person.phoneNumber,
        email: person.email,
        stage: stageFromAccount(sub?.status ?? null, plan?.status ?? null),
        planId: sub?.planId ?? plan?.planId ?? "free",
        renewalAt: sub?.periodEnd ?? null,
        trialEndsAt: null,
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
    }),
  );
}

export type ContactListItem = {
  id: string;
  kind: string;
  name: string;
  phone: string | null;
  email: string | null;
  stage: string;
  planId: string | null;
  renewalAt: string | null;
  trialEndsAt: string | null;
  tags: string[];
  userId: string | null;
};

export async function listContacts(filter: {
  stage?: string;
  planId?: string;
  trialEnding?: boolean;
  churned?: boolean;
  q?: string;
}): Promise<ContactListItem[]> {
  await syncMemberContacts();
  const rows = await getDb().select().from(crmContacts).orderBy(desc(crmContacts.updatedAt));
  const now = Date.now();
  const soon = now + TRIAL_WINDOW_MS;
  const query = filter.q?.trim().toLowerCase() ?? "";
  return rows
    .filter((row) => {
      if (filter.churned && row.stage !== "churned") return false;
      if (filter.stage && row.stage !== filter.stage) return false;
      if (filter.planId && row.planId !== filter.planId) return false;
      if (filter.trialEnding) {
        const trial = row.trialEndsAt ? Date.parse(row.trialEndsAt) : Number.NaN;
        const ending = Number.isFinite(trial) && trial >= now - 24 * 60 * 60 * 1000 && trial <= soon;
        if (!ending && row.stage !== "trial") return false;
      }
      if (!query) return true;
      return `${row.name} ${row.phone ?? ""} ${row.email ?? ""} ${row.tags.join(" ")}`.toLowerCase().includes(query);
    })
    .map(toListItem);
}

function toListItem(row: typeof crmContacts.$inferSelect): ContactListItem {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    phone: row.phone,
    email: row.email,
    stage: row.stage,
    planId: row.planId,
    renewalAt: row.renewalAt,
    trialEndsAt: row.trialEndsAt,
    tags: row.tags ?? [],
    userId: row.userId,
  };
}

export async function createLead(input: { name: string; phone: string; email?: string; authorId: string }): Promise<string> {
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  if (name.length < 2) throw new AppError(400, "VALIDATION_ERROR", "Enter the person's name.", { name: "Enter a name." });
  if (!phone) throw new AppError(400, "VALIDATION_ERROR", "Enter a valid phone number.", { phone: "Use a full mobile number." });
  const db = getDb();
  const id = createId("crm");
  const now = nowIso();
  await db.insert(crmContacts).values({
    id,
    userId: null,
    kind: "lead",
    name,
    phone,
    email: input.email?.trim() || null,
    stage: "new",
    planId: null,
    renewalAt: null,
    trialEndsAt: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
  });
  await addActivity(id, "created", `${name} was added as a lead.`);
  return id;
}

export async function getContactDetail(id: string) {
  const db = getDb();
  const rows = await db.select().from(crmContacts).where(eq(crmContacts.id, id)).limit(1);
  const contact = rows[0];
  if (!contact) throw new AppError(404, "NOT_FOUND", "That person is not in the CRM.");
  const [notes, reminders, activities, payments, subs, calls] = await Promise.all([
    db.select().from(crmNotes).where(eq(crmNotes.contactId, id)).orderBy(desc(crmNotes.createdAt)),
    db.select().from(crmReminders).where(eq(crmReminders.contactId, id)).orderBy(asc(crmReminders.dueAt)),
    db.select().from(crmActivities).where(eq(crmActivities.contactId, id)).orderBy(desc(crmActivities.createdAt)),
    contact.userId
      ? db.select().from(paymentOrders).where(eq(paymentOrders.userId, contact.userId)).orderBy(desc(paymentOrders.createdAt))
      : Promise.resolve([]),
    contact.userId
      ? db.select().from(subscriptions).where(eq(subscriptions.userId, contact.userId)).orderBy(desc(subscriptions.updatedAt))
      : Promise.resolve([]),
    db.select().from(voiceCalls).where(eq(voiceCalls.contactId, id)).orderBy(desc(voiceCalls.createdAt)),
  ]);
  const current = subs[0] ?? null;
  return {
    contact: toListItem(contact),
    plan: {
      planId: contact.planId,
      status: current?.status ?? null,
      renewalAt: contact.renewalAt ?? current?.periodEnd ?? null,
      trialEndsAt: contact.trialEndsAt,
    },
    payments: payments.map((row) => ({
      id: row.id,
      amountMinor: row.amountMinor,
      currency: row.currency,
      status: row.status,
      createdAt: row.createdAt,
    })),
    notes: notes.map((row) => ({ id: row.id, body: row.body, authorId: row.authorId, createdAt: row.createdAt })),
    reminders: reminders.map((row) => ({ id: row.id, body: row.body, dueAt: row.dueAt, doneAt: row.doneAt })),
    timeline: activities.map((row) => ({ id: row.id, kind: row.kind, summary: row.summary, createdAt: row.createdAt })),
    calls: calls.map((row) => ({
      id: row.id,
      status: row.status,
      durationSeconds: row.durationSeconds,
      recordingUrl: row.recordingUrl,
      transcript: row.transcript,
      simulated: row.simulated,
      createdAt: row.createdAt,
    })),
  };
}

export async function updateContact(
  id: string,
  patch: { stage?: string; tags?: string[]; trialEndsAt?: string | null; planId?: string | null },
  authorId: string,
): Promise<void> {
  const db = getDb();
  const rows = await db.select().from(crmContacts).where(eq(crmContacts.id, id)).limit(1);
  const current = rows[0];
  if (!current) throw new AppError(404, "NOT_FOUND", "That person is not in the CRM.");
  const next: Partial<typeof crmContacts.$inferInsert> = { updatedAt: nowIso() };
  if (patch.stage !== undefined) {
    if (!isCrmStage(patch.stage)) throw new AppError(400, "VALIDATION_ERROR", "Choose a pipeline stage.", { stage: "Unknown stage." });
    next.stage = patch.stage;
  }
  if (patch.tags) {
    next.tags = [...new Set(patch.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0 && tag.length <= 32))].slice(0, 12);
  }
  if (patch.trialEndsAt !== undefined) next.trialEndsAt = patch.trialEndsAt;
  if (patch.planId !== undefined) next.planId = patch.planId;
  await db.update(crmContacts).set(next).where(eq(crmContacts.id, id));
  if (patch.stage && patch.stage !== current.stage) {
    await addActivity(id, "stage", `Stage moved from ${current.stage} to ${patch.stage}.`);
  }
  if (patch.tags) await addActivity(id, "tags", `Tags updated by ${authorId}.`);
}

export async function addNote(contactId: string, authorId: string, body: string): Promise<void> {
  const text = body.trim();
  if (text.length < 2 || text.length > 2000) {
    throw new AppError(400, "VALIDATION_ERROR", "Write a short note.", { body: "Use 2 to 2000 characters." });
  }
  await assertContact(contactId);
  const now = nowIso();
  await getDb().insert(crmNotes).values({ id: createId("note"), contactId, authorId, body: text, createdAt: now });
  await addActivity(contactId, "note", text);
}

export async function addReminder(contactId: string, authorId: string, body: string, dueAt: string): Promise<void> {
  const text = body.trim();
  const due = Date.parse(dueAt);
  if (text.length < 2) throw new AppError(400, "VALIDATION_ERROR", "Write what to follow up on.", { body: "Add a reminder." });
  if (!Number.isFinite(due)) throw new AppError(400, "VALIDATION_ERROR", "Choose a follow-up time.", { dueAt: "Enter a date." });
  await assertContact(contactId);
  const now = nowIso();
  await getDb().insert(crmReminders).values({
    id: createId("rem"),
    contactId,
    authorId,
    body: text,
    dueAt: new Date(due).toISOString(),
    doneAt: null,
    createdAt: now,
  });
  await addActivity(contactId, "reminder", `Follow up ${new Date(due).toISOString().slice(0, 10)}: ${text}`);
}

export async function completeReminder(contactId: string, reminderId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(crmReminders)
    .where(and(eq(crmReminders.id, reminderId), eq(crmReminders.contactId, contactId)))
    .limit(1);
  if (!rows[0]) throw new AppError(404, "NOT_FOUND", "That reminder is not on this person.");
  await db.update(crmReminders).set({ doneAt: nowIso() }).where(eq(crmReminders.id, reminderId));
  await addActivity(contactId, "reminder", `Follow-up marked done: ${rows[0].body}`);
}

export async function addActivity(contactId: string, kind: string, summary: string): Promise<void> {
  await getDb().insert(crmActivities).values({
    id: createId("act"),
    contactId,
    kind,
    summary: summary.slice(0, 500),
    createdAt: nowIso(),
  });
}

async function assertContact(id: string): Promise<void> {
  const rows = await getDb().select({ id: crmContacts.id }).from(crmContacts).where(eq(crmContacts.id, id)).limit(1);
  if (!rows[0]) throw new AppError(404, "NOT_FOUND", "That person is not in the CRM.");
}

export async function contactsForCampaign(kind: string): Promise<Array<{ id: string; name: string; phone: string }>> {
  await syncMemberContacts();
  const rows = await getDb().select().from(crmContacts);
  const now = Date.now();
  const soon = now + 14 * 24 * 60 * 60 * 1000;
  return rows
    .filter((row) => {
      if (!row.phone) return false;
      if (kind === "inbound_faq") return false;
      if (kind === "trial_followup") {
        const trial = row.trialEndsAt ? Date.parse(row.trialEndsAt) : Number.NaN;
        return row.stage === "trial" || (Number.isFinite(trial) && trial <= soon);
      }
      const renewal = row.renewalAt ? Date.parse(row.renewalAt) : Number.NaN;
      return row.stage === "paid" && Number.isFinite(renewal) && renewal <= soon;
    })
    .slice(0, 25)
    .map((row) => ({ id: row.id, name: row.name, phone: row.phone as string }));
}
