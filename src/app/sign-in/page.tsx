"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandSplash } from "@/components/brand";
import { ErrorState } from "@/components/states";
import { Wordmark } from "@/components/wordmark";
import { MaintenanceGate } from "@/features/app/member-config";
import { useAuth, useSignedInRedirect } from "@/features/auth/auth-provider";

export default function SignInPage() {
  const { state } = useAuth();
  useSignedInRedirect();

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
      </div>
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
