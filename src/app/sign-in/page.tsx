"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandSplash } from "@/components/brand";
import { ErrorState } from "@/components/states";
import { Wordmark } from "@/components/wordmark";
import { MaintenanceGate } from "@/features/app/member-config";
import { useAuth, useSignedInRedirect } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";

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
  const { state, refresh } = useAuth();
  useSignedInRedirect();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const demo = process.env.NEXT_PUBLIC_DEMO_LOGIN === "true";

  async function devSignIn(uid: string) {
    setBusy(true);
    setMessage(null);
    const minted = await apiFetch<{ uid: string }>("/api/v1/dev/demo-login", {
      method: "POST",
      body: JSON.stringify({ uid }),
    });
    if (!minted.ok) {
      setMessage(minted.message);
      setBusy(false);
      return;
    }
    await refresh();
    setBusy(false);
  }

  if (state.status === "loading") return <BrandSplash label="Checking session" />;

  return (
    <MaintenanceGate>
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="card p-6">
        <Link href="/" aria-label="inStox" className="inline-flex">
          <Wordmark decorative className="h-12 w-auto" />
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Use a phone code. Read the <Link href="/disclaimer" className="text-primary hover:underline">risk disclosure</Link> before you rely on any tip.
        </p>
        {state.status === "error" ? <div className="mt-4"><ErrorState message={state.message} /></div> : null}
        {state.status === "ready" && state.emailConflict ? (
          <p className="mt-4 text-sm text-warning" role="status">
            Another account already uses this email. The accounts were not merged.
          </p>
        ) : null}
        <SignInPanel />
        {message ? <p className="mt-4 text-sm text-ink" role="alert">{message}</p> : null}
      </div>
      {demo ? (
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

function SignInPanel() {
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
    </div>
  );
}
