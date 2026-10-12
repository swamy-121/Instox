import { getFirebaseWebConfig } from "@/lib/firebase-client";
import { firebaseMessagingSwSource } from "@/server/notifications/messaging-sw";

export function GET(): Response {
  const web = getFirebaseWebConfig();
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "";
  const config =
    web && messagingSenderId
      ? {
          apiKey: web.apiKey,
          authDomain: web.authDomain,
          projectId: web.projectId,
          appId: web.appId,
          messagingSenderId,
        }
      : null;
  return new Response(firebaseMessagingSwSource(config), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Service-Worker-Allowed": "/",
    },
  });
}
