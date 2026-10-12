import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, withApi } from "@/server/http";
import { clientMessagingConfigured, fcmConfigured } from "@/server/notifications/push";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/notifications", async ({ requestId }) => {
    const actor = await requireActor(request);
    const db = adminDb();
    const [userSnap, tokens] = await Promise.all([
      db.collection("users").doc(actor.uid).get(),
      db.collection("fcmTokens").where("uid", "==", actor.uid).limit(20).get(),
    ]);
    const user = userSnap.data() ?? {};
    return apiOk(
      {
        preferences: {
          tipPush: user.tipPush === true,
          marketingPush: user.marketingPush === true,
        },
        devices: tokens.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            revoked: data.revoked === true,
            createdAt: String(data.createdAt ?? ""),
          };
        }),
        fcmConfigured: fcmConfigured(),
        clientConfigured: clientMessagingConfigured(),
      },
      requestId,
    );
  });
}
