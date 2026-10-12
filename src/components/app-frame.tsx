"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Bell } from "lucide-react";
import { BrandSplash } from "@/components/brand";
import { BottomNav, DesktopNav } from "@/components/chrome";
import { ErrorState, PermissionDenied } from "@/components/states";
import { Wordmark } from "@/components/wordmark";
import { useAuth } from "@/features/auth/auth-provider";
import { canAccessAdmin } from "@/server/authorization/roles";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/tips", label: "Tips" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/instruments", label: "Instruments" },
  { href: "/admin/screener", label: "Screener" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/referrals", label: "Referrals" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/content/indices", label: "Indices" },
  { href: "/admin/content/newsArticles", label: "News" },
  { href: "/admin/content/helpArticles", label: "Help" },
  { href: "/admin/content/shopProducts", label: "Shop" },
  { href: "/admin/content/onboardingSlides", label: "Onboarding" },
  { href: "/admin/content/paymentMethods", label: "Pay methods" },
];

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

  if (state.status === "loading") return <BrandSplash label="Loading Instox" />;

  if (requireAuth || admin) {
    if (state.status === "unconfigured") {
      return (
        <div className="mx-auto max-w-md px-4 py-16">
          <ErrorState message="Sign-in is not available right now." />
        </div>
      );
    }
    if (state.status === "signed_out") {
      return (
        <div className="mx-auto max-w-md px-4 py-16">
          <div className="card">
            <h1 className="text-lg font-semibold">Sign in required</h1>
            <p className="mt-2 text-sm leading-6 text-muted">This page is available after you sign in.</p>
            <Link href="/sign-in" className="btn-primary mt-4">
              Sign in
            </Link>
          </div>
        </div>
      );
    }
    if (state.status === "error") {
      return (
        <div className="mx-auto max-w-md px-4 py-16">
          <ErrorState message={state.message} />
        </div>
      );
    }
    if (state.status === "ready" && state.me.status !== "active") {
      return (
        <div className="mx-auto max-w-md px-4 py-16">
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
      return <BrandSplash label="Opening profile" />;
    }
    if (admin && state.status === "ready" && !canAccessAdmin(state.me.roles)) {
      return (
        <div className="mx-auto max-w-md px-4 py-16">
          <PermissionDenied message="Your account does not include an admin role." />
        </div>
      );
    }
  }

  if (admin) return <AdminShell>{children}</AdminShell>;

  const signedIn = state.status === "ready";

  return (
    <div className="min-h-screen bg-white">
      <MemberHeader signedIn={signedIn} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:pb-10">{children}</main>
      {signedIn ? <BottomNav /> : null}
    </div>
  );
}

function MemberHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const { state } = useAuth();
  const home = pathname === "/home" && state.status === "ready";
  const name = state.status === "ready" ? state.me.displayName || "there" : "there";
  const initial = name.trim().slice(0, 1).toUpperCase() || "I";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white">
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3 px-4 py-3">
        {home ? (
          <div className="min-w-0">
            <p className="text-sm text-muted">Hi, {name}</p>
            <p className="text-base font-semibold leading-5 text-ink">Let us find your next opportunity</p>
          </div>
        ) : (
          <Link href={signedIn ? "/home" : "/"} aria-label="inStox" className="inline-flex shrink-0 items-center">
            <Wordmark decorative className="h-12 w-auto" />
          </Link>
        )}
        <div className="flex items-center gap-2">
          {signedIn ? <DesktopNav /> : null}
          {home ? (
            <>
              <Link href="/settings" aria-label="Notifications" className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-canvas">
                <Bell className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link href="/profile" aria-label="Profile" className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                {initial}
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-canvas md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="brand-surface border-b border-line md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/admin" aria-label="inStox admin" className="inline-flex items-center">
            <Wordmark decorative className="h-11 w-auto" />
          </Link>
          <Link href="/home" className="text-sm font-medium text-primary md:hidden">
            App
          </Link>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:px-3 md:pb-6" aria-label="Admin">
          {ADMIN_LINKS.map((link) => {
            const active = link.href === "/admin" ? pathname === "/admin" : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium ${active ? "bg-primary-soft text-primary" : "text-ink hover:bg-canvas"}`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
          <Link href="/home" className="mt-2 hidden rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-canvas hover:text-ink md:block">
            Back to app
          </Link>
        </nav>
      </aside>
      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">{children}</div>
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
