import { arrayContains, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/sql-error";
import { fcmTokens, notificationCampaigns, userRoles } from "@/server/db/schema";
import { refreshIntegrations } from "@/server/integrations/store";
import { markAliceReminderSent, readAliceConnection } from "@/server/market-data/alice-store";
import { activeFeedId } from "@/server/market-data/quotes";
import { aliceReminderDue, istClock } from "@/server/market-data/session";
import { getFcmMessaging } from "@/server/notifications/firebase-app";
import { fcmConfigured } from "@/server/notifications/push";

const TITLE = "Connect Alice Blue";
const BODY = "Index prices are delayed. Connect Alice Blue before the market session.";

let sending = false;

export async function maybeSendAliceReminder(now = new Date()): Promise<void> {
  if (sending) return;
  await refreshIntegrations();
  if (activeFeedId() !== "aliceblue") return;
  const connection = await readAliceConnection(now);
  if (!aliceReminderDue({
    now,
    provider: "aliceblue",
    connected: connection.connected,
    reminderSentOn: connection.reminderSentOn,
  })) return;

  sending = true;
  const day = istClock(now).date;
  const db = getDb();
  const id = `alice-reminder-${day}`;
  try {
    await db.insert(notificationCampaigns).values({
      id,
      title: TITLE,
      body: BODY,
      audience: "admin",
      kind: "alice_reminder",
      channel: "fcm",
      status: "pending",
      createdAt: now.toISOString(),
    });
    await markAliceReminderSent(day, now);
    const status = await deliverAdminReminder();
    await db.update(notificationCampaigns).set({ status, updatedAt: new Date().toISOString() }).where(eq(notificationCampaigns.id, id));
  } catch (error) {
    if (!isUniqueViolation(error)) {
      console.error(JSON.stringify({ route: "alice-reminder", category: "INTERNAL_ERROR" }));
    }
  } finally {
    sending = false;
  }
}

async function deliverAdminReminder(): Promise<"sent" | "skipped_unconfigured" | "skipped_no_device"> {
  if (!fcmConfigured()) return "skipped_unconfigured";
  const messaging = await getFcmMessaging();
  if (!messaging) return "skipped_unconfigured";
  const db = getDb();
  const [admins, supers] = await Promise.all([
    db.select().from(userRoles).where(arrayContains(userRoles.roles, ["admin"])).limit(50),
    db.select().from(userRoles).where(arrayContains(userRoles.roles, ["super_admin"])).limit(50),
  ]);
  const uids = new Set([...admins, ...supers].map((row) => row.userId));
  const messages: Array<{ token: string; data: { title: string; body: string; url: string } }> = [];
  for (const uid of uids) {
    const tokens = await db.select().from(fcmTokens).where(eq(fcmTokens.userId, uid)).limit(10);
    for (const tokenRow of tokens) {
      if (tokenRow.revoked || !tokenRow.token) continue;
      messages.push({ token: tokenRow.token, data: { title: TITLE, body: BODY, url: "/admin" } });
    }
  }
  if (messages.length === 0) return "skipped_no_device";
  await messaging.sendEach(messages);
  return "sent";
}
