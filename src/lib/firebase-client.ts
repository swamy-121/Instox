import { getApps, initializeApp, type FirebaseApp } from "firebase/app";

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
};

export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
  if (!projectId || !apiKey) return null;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "";
  return {
    apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    projectId,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:000000000000:web:demoinstox",
    ...(messagingSenderId ? { messagingSenderId } : {}),
  };
}

export function getFirebaseApp(): FirebaseApp | null {
  const config = getFirebaseWebConfig();
  if (!config) return null;
  return getApps()[0] ?? initializeApp(config);
}
