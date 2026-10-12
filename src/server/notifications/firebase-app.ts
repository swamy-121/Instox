export async function getFcmMessaging(): Promise<{
  sendEach: (messages: unknown[]) => Promise<{ responses: Array<{ success: boolean; error?: { code?: string } }> }>;
  subscribeToTopic: (tokens: string[], topic: string) => Promise<unknown>;
  unsubscribeFromTopic: (tokens: string[], topic: string) => Promise<unknown>;
} | null> {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!clientEmail || !privateKey || !projectId) return null;
  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getMessaging } = await import("firebase-admin/messaging");
  const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  return getMessaging(app) as unknown as Awaited<ReturnType<typeof getFcmMessaging>>;
}
