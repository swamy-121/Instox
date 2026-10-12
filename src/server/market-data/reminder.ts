import { getMessaging } from "firebase-admin/messaging";
import { adminDb, getAdminApp } from "@/server/db/admin";
import { readAliceConnection } from "@/server/market-data/alice-store";
import { activeFeedId } from "@/server/market-data/quotes";
import { aliceReminderDue, istClock } from "@/server/market-data/session";
import { fcmConfigured } from "@/server/notifications/push";

const TITLE = "Connect Alice Blue";
const BODY = "Index prices are delayed. Connect Alice Blue before the market session.";

let sending = false;

export async function maybeSendAliceReminder(now = new Date()): Promise<void> {
  if (sending || activeFeedId() !== "aliceblue") return;
  const connection = await readAliceConnection(now);
  if (!aliceReminderDue({
    now,
    provider: "aliceblue",
    connected: connection.connected,
    reminderSentOn: connection.reminderSentOn,
  })) return;

  sending = true;
  const day = istClock(now).date;
  const db = adminDb();
  const campaign = db.collection("notificationCampaigns").doc(`alice-reminder-${day}`);
  try {
    await campaign.create({
      id: campaign.id,
      title: TITLE,
      body: BODY,
      audience: "admin",
      kind: "alice_reminder",
      channel: "fcm",
      status: "pending",
      createdAt: now.toISOString(),
    });
    await db.collection("appConfig").doc("aliceblue").set({ reminderSentOn: day, updatedAt: now.toISOString() }, { merge: true });
    const status = await deliverAdminReminder();
    await campaign.set({ status, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code !== "6" && code !== "already-exists") {
      console.error(JSON.stringify({ route: "alice-reminder", category: "INTERNAL_ERROR" }));
    }
  } finally {
    sending = false;
  }
}

async function deliverAdminReminder(): Promise<"sent" | "skipped_unconfigured" | "skipped_no_device"> {
  if (!fcmConfigured()) return "skipped_unconfigured";
  const db = adminDb();
  const [admins, supers] = await Promise.all([
    db.collection("userRoles").where("roles", "array-contains", "admin").limit(50).get(),
    db.collection("userRoles").where("roles", "array-contains", "super_admin").limit(50).get(),
  ]);
  const uids = new Set([...admins.docs, ...supers.docs].map((doc) => doc.id));
  const messages: Array<{ token: string; data: { title: string; body: string; url: string } }> = [];
  for (const uid of uids) {
    const tokens = await db.collection("fcmTokens").where("uid", "==", uid).limit(10).get();
    for (const tokenDoc of tokens.docs) {
      const token = tokenDoc.data().token;
      if (tokenDoc.data().revoked === true || typeof token !== "string" || !token) continue;
      messages.push({ token, data: { title: TITLE, body: BODY, url: "/admin" } });
    }
  }
  if (messages.length === 0) return "skipped_no_device";
  await getMessaging(getAdminApp()).sendEach(messages);
  return "sent";
}
