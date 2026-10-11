"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BottomNav, DesktopNav } from "@/components/chrome";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { canAccessAdmin } from "@/server/authorization/roles";

export function AppFrame({
  children,
  requireAuth = false,
  admin = false,
}: {
  children: React.ReactNode;
  requireAuth?: boolean;
  admin?: boolean;
}) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!requireAuth && !admin) return;
    if (state.status === "ready" && state.me.status === "active" && !state.me.profileComplete) {
      router.replace("/profile/complete");
    }
  }, [admin, requireAuth, router, state]);

  if (state.status === "loading") return <div className="mx-auto max-w-3xl px-4 py-8"><LoadingState /></div>;

  if (requireAuth || admin) {
    if (state.status === "unconfigured") {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <ErrorState message="Firebase is not configured. Copy .env.example to .env.local and start the emulators." />
        </div>
      );
    }
    if (state.status === "signed_out") {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="card">
            <h1 className="text-lg font-semibold">Sign in required</h1>
            <p className="mt-2 text-sm text-muted">This page is available after you sign in.</p>
            <Link href="/sign-in" className="btn-primary mt-4">
              Sign in
            </Link>
          </div>
        </div>
      );
    }
    if (state.status === "error") {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <ErrorState message={state.message} />
        </div>
      );
    }
    if (state.status === "ready" && state.me.status !== "active") {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <PermissionDenied
            message={
              state.me.status === "disabled"
                ? "This account is disabled. Sign out, or ask an administrator to review it."
                : "A deletion request is pending. Access is paused while that request stays open."
            }
          />
          <SignOutRow />
        </div>
      );
    }
    if (state.status === "ready" && !state.me.profileComplete) {
      return <div className="mx-auto max-w-3xl px-4 py-8"><LoadingState label="Opening profile" /></div>;
    }
    if (admin && state.status === "ready" && !canAccessAdmin(state.me.roles)) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <PermissionDenied message="Your account does not include an admin role." />
        </div>
      );
    }
  }

  const signedIn = state.status === "ready";

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pb-24 pt-4 md:pb-10">
      <header className="mb-6 flex items-center justify-between gap-4">
        <Link href={signedIn ? "/home" : "/"} className="text-lg font-semibold text-navy">
          Instox
        </Link>
        {signedIn && !admin ? <DesktopNav /> : null}
        {admin ? (
          <nav className="flex flex-wrap gap-3 text-sm" aria-label="Admin">
            <Link href="/admin">Overview</Link>
            <Link href="/admin/tips">Tips</Link>
            <Link href="/admin/users">Users</Link>
            <Link href="/admin/audit">Audit</Link>
            <Link href="/home">App</Link>
          </nav>
        ) : null}
      </header>
      {children}
      {signedIn && !admin ? <BottomNav /> : null}
    </div>
  );
}

function SignOutRow() {
  const { signOutUser } = useAuth();
  return (
    <button type="button" className="btn-secondary mt-4" onClick={() => void signOutUser()}>
      Sign out
    </button>
  );
}
