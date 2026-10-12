import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
};

let emulatorConnected = false;

export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  const emulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || (emulator ? "demo-instox" : "");
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || (emulator ? "demo-api-key" : "");
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

export function getClientAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  const auth = getAuth(getApp());
  if (!emulatorConnected && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true" && typeof window !== "undefined") {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    emulatorConnected = true;
  }
  return auth;
}
