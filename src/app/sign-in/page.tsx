"use client";

import { GoogleAuthProvider, signInWithCustomToken, signInWithPopup } from "firebase/auth";
import Link from "next/link";
import { useState } from "react";
import { ErrorState, LoadingState } from "@/components/states";
import { useAuth, useSignedInRedirect } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { getClientAuth } from "@/lib/firebase-client";

const DEV_USERS = [
  ["seed_free", "Free member"],
  ["seed_premium", "Premium member"],
  ["seed_editor", "Editor"],
  ["seed_publisher", "Publisher"],
  ["seed_support", "Support"],
  ["seed_admin", "Admin"],
  ["seed_super", "Super admin"],
  ["seed_disabled", "Disabled account"],
] as const;

export default function SignInPage() {
  const { state } = useAuth();
  useSignedInRedirect();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

  async function google() {
    const auth = getClientAuth();
    if (!auth) return;
    setBusy(true);
    setMessage(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code === "auth/account-exists-with-different-credential") {
        setMessage("This Google account is already tied to a different sign-in method. Instox will not merge the two identities.");
      } else if (code === "auth/popup-closed-by-user") {
        setMessage("Google sign-in was cancelled.");
      } else {
        setMessage("Google sign-in failed. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function devSignIn(uid: string) {
    const auth = getClientAuth();
    if (!auth) return;
    setBusy(true);
    setMessage(null);
    const minted = await apiFetch<{ customToken: string }>("/api/v1/dev/custom-token", {
      method: "POST",
      body: JSON.stringify({ uid }),
    });
    if (!minted.ok) {
      setMessage(minted.message);
      setBusy(false);
      return;
    }
    try {
      await signInWithCustomToken(auth, minted.data.customToken);
    } catch {
      setMessage("Emulator sign-in failed. Is the Auth emulator running, and has the seed script been run?");
    } finally {
      setBusy(false);
    }
  }

  if (state.status === "loading") return <main className="mx-auto max-w-md px-4 py-10"><LoadingState label="Checking session" /></main>;
  if (state.status === "unconfigured") {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <ErrorState message="Firebase is not configured. Copy .env.example to .env.local and set NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true for local auth." />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Link href="/" className="text-sm text-muted">
        Instox
      </Link>
      <h1 className="mt-4 text-3xl font-semibold text-navy">Sign in</h1>
      <p className="mt-2 text-sm text-muted">
        Use a phone code or Google. Read the <Link href="/disclaimer" className="underline">risk disclosure</Link> before you rely on any tip.
      </p>
      {state.status === "error" ? <div className="mt-4"><ErrorState message={state.message} /></div> : null}
      {state.status === "ready" && state.emailConflict ? (
        <p className="mt-4 text-sm text-warning" role="status">
          Another account already uses this email. The accounts were not merged.
        </p>
      ) : null}
      <div className="mt-6 space-y-3">
        <Link href="/sign-in/phone" className="btn-primary w-full">
          Continue with phone
        </Link>
        <button type="button" className="btn-secondary w-full" onClick={() => void google()} disabled={busy}>
          {busy ? "Waiting" : "Continue with Google"}
        </button>
      </div>
      {message ? <p className="mt-4 text-sm text-danger" role="alert">{message}</p> : null}
      {emulator ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Emulator users</h2>
          <p className="mt-1 text-xs text-muted">Local only. These buttons call the Auth emulator. They are hidden when the emulator flag is off.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {DEV_USERS.map(([uid, label]) => (
              <button key={uid} type="button" className="btn-secondary" disabled={busy} onClick={() => void devSignIn(uid)}>
                {label}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
