import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function projectId(): string {
  return process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-instox";
}

export function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);

  if (!emulator && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId: projectId(), clientEmail, privateKey }),
      projectId: projectId(),
    });
  }

  return initializeApp({ projectId: projectId() });
}

export function adminAuth(): Auth {
  getAdminApp();
  return getAuth();
}

export function adminDb(): Firestore {
  getAdminApp();
  return getFirestore();
}
