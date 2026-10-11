import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, withApi } from "@/server/http";
import { vapidConfigured } from "@/server/notifications/push";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/notifications", async ({ requestId }) => {
    const actor = await requireActor(request);
    const db = adminDb();
    const [userSnap, subs] = await Promise.all([
      db.collection("users").doc(actor.uid).get(),
      db.collection("pushSubscriptions").where("uid", "==", actor.uid).limit(20).get(),
    ]);
    const user = userSnap.data() ?? {};
    return apiOk(
      {
        preferences: {
          tipPush: user.tipPush === true,
          marketingPush: user.marketingPush === true,
        },
        subscriptions: subs.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            revoked: data.revoked === true,
            createdAt: String(data.createdAt ?? ""),
          };
        }),
        vapidConfigured: vapidConfigured(),
        publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
      },
      requestId,
    );
  });
}
