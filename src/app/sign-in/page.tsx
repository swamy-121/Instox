"use client";

import Link from "next/link";
import { BrandSplash } from "@/components/brand";
import { ErrorState } from "@/components/states";
import { Wordmark } from "@/components/wordmark";
import { MaintenanceGate } from "@/features/app/member-config";
import { useAuth, useSignedInRedirect } from "@/features/auth/auth-provider";
import { PhoneStart } from "@/features/auth/phone-start";

export default function SignInPage() {
  const { state } = useAuth();
  useSignedInRedirect();

  if (state.status === "loading") return <BrandSplash label="Checking session" />;

  return (
    <MaintenanceGate>
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-canvas px-4 py-10">
      <div className="card p-6">
        <Link href="/" aria-label="Instox" className="inline-flex">
          <Wordmark decorative className="h-8 w-auto" />
        </Link>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          We&apos;ll send a one-time code to your phone. Please read the <Link href="/disclaimer" className="font-semibold text-primary">risk disclosure</Link> before you rely on any tip.
        </p>
        {state.status === "error" ? <div className="mt-4"><ErrorState message={state.message} /></div> : null}
        {state.status === "ready" && state.emailConflict ? (
          <p className="mt-4 text-sm text-warning" role="status">
            This email is already linked to another account, so we kept them separate.
          </p>
        ) : null}
        <div className="mt-5">
          <PhoneStart />
        </div>
      </div>
    </main>
    </MaintenanceGate>
  );
}

