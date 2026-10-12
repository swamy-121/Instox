"use client";

import { GoogleAuthProvider, signInWithCustomToken, signInWithPopup } from "firebase/auth";
import Link from "next/link";
import { useState } from "react";
import { BrandSplash } from "@/components/brand";
import { ErrorState } from "@/components/states";
import { Wordmark } from "@/components/wordmark";
import { MaintenanceGate } from "@/features/app/member-config";
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
      setMessage("Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state.status === "loading") return <BrandSplash label="Checking session" />;
  if (state.status === "unconfigured") {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <ErrorState message="Firebase is not configured. Copy .env.example to .env.local and set NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true for local auth." />
      </main>
    );
  }

  return (
    <MaintenanceGate>
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="card p-6">
        <Link href="/" aria-label="inStox" className="inline-flex">
          <Wordmark decorative className="h-12 w-auto" />
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Use a phone code or Google. Read the <Link href="/disclaimer" className="text-primary hover:underline">risk disclosure</Link> before you rely on any tip.
        </p>
        {state.status === "error" ? <div className="mt-4"><ErrorState message={state.message} /></div> : null}
        {state.status === "ready" && state.emailConflict ? (
          <p className="mt-4 text-sm text-warning" role="status">
            Another account already uses this email. The accounts were not merged.
          </p>
        ) : null}
        <SignInPanel busy={busy} onGoogle={() => void google()} />
        {message ? <p className="mt-4 text-sm text-ink" role="alert">{message}</p> : null}
      </div>
      {emulator ? (
        <section className="mt-6">
          <div className="grid grid-cols-2 gap-2">
            {DEV_USERS.map(([uid, label]) => (
              <button key={uid} type="button" className="btn-quiet" disabled={busy} onClick={() => void devSignIn(uid)}>
                {label}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </main>
    </MaintenanceGate>
  );
}

function SignInPanel({ busy, onGoogle }: { busy: boolean; onGoogle: () => void }) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [national, setNational] = useState("");
  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 rounded-full bg-canvas p-1 text-sm font-medium">
        <button type="button" className={`h-10 rounded-full ${tab === "login" ? "bg-primary text-white" : "text-ink"}`} onClick={() => setTab("login")}>Login</button>
        <button type="button" className={`h-10 rounded-full ${tab === "signup" ? "bg-primary text-white" : "text-ink"}`} onClick={() => setTab("signup")}>Sign up</button>
      </div>
      <label className="label mt-4" htmlFor="mobile">Mobile number</label>
      <div className="flex gap-2">
        <span className="inline-flex h-11 items-center rounded-xl border border-line px-3 text-sm text-ink">+91</span>
        <input id="mobile" className="field" inputMode="numeric" autoComplete="tel" value={national} onChange={(event) => setNational(event.target.value)} placeholder="10 digit mobile" />
      </div>
      <Link href={`/sign-in/phone?national=${encodeURIComponent(national)}`} className="btn-primary mt-4 w-full">
        {tab === "login" ? "Send OTP" : "Create account"}
      </Link>
      <button type="button" className="btn-secondary mt-3 w-full" onClick={onGoogle} disabled={busy}>
        {busy ? "Waiting" : "Continue with Google"}
      </button>
      <p className="mt-3 text-center text-xs text-muted">Email sign-in is not enabled. Use a phone code or Google.</p>
    </div>
  );
}
