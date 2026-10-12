"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Contact,
  CreditCard,
  Crown,
  KeyRound,
  LayoutDashboard,
  Phone,
  LifeBuoy,
  LineChart,
  Megaphone,
  Newspaper,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Users,
} from "lucide-react";
import { BrandSplash } from "@/components/brand";
import { BottomNav, DesktopNav } from "@/components/chrome";
import { ErrorState, PermissionDenied } from "@/components/states";
import { Wordmark } from "@/components/wordmark";
import { MemberConfigProvider, useMemberConfig } from "@/features/app/member-config";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { canAccessAdmin, canManageCrm, canManageIntegrations, canManageOperations } from "@/server/authorization/roles";

const ADMIN_LINKS: Array<{ href: string; label: string; icon: typeof LayoutDashboard; superAdmin?: boolean; crm?: boolean }> = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/tips", label: "Trading Tips", icon: LineChart },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/crm", label: "CRM", icon: Contact, crm: true },
  { href: "/admin/voice", label: "Voice", icon: Phone, crm: true },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/plans", label: "Plans", icon: Crown },
  { href: "/admin/screener", label: "Screener", icon: SlidersHorizontal },
  { href: "/admin/news", label: "Market News", icon: Newspaper },
  { href: "/admin/shop", label: "Shop", icon: ShoppingBag },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/advertisements", label: "Advertisements", icon: Megaphone },
  { href: "/admin/member", label: "Member app", icon: Smartphone },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/integrations", label: "Integrations", icon: KeyRound, superAdmin: true },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
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
    if (state.status === "signed_out") {
      if (admin) return <AdminLoginRedirect />;
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
    <MemberConfigProvider>
      <MemberShell signedIn={signedIn}>{children}</MemberShell>
    </MemberConfigProvider>
  );
}

function MemberShell({ children, signedIn }: { children: React.ReactNode; signedIn: boolean }) {
  const config = useMemberConfig();
  const { signOutUser } = useAuth();
  return (
    <div className="min-h-screen bg-white">
      <MemberHeader signedIn={signedIn} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:pb-10">
        {config.maintenance ? (
          <div className="card">
            <h1 className="text-lg font-semibold text-ink">{config.maintenanceTitle}</h1>
            <p className="mt-2 text-sm leading-6 text-muted">{config.maintenanceBody}</p>
            {signedIn ? (
              <button type="button" className="btn-secondary mt-4" onClick={() => void signOutUser()}>
                Sign out
              </button>
            ) : null}
          </div>
        ) : (
          children
        )}
      </main>
      {signedIn && !config.maintenance ? <BottomNav /> : null}
    </div>
  );
}

function MemberHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const { state } = useAuth();
  const config = useMemberConfig();
  const home = pathname === "/home" && state.status === "ready";
  const name = state.status === "ready" ? state.me.displayName || "there" : "there";
  const initial = name.trim().slice(0, 1).toUpperCase() || "I";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white">
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3 px-4 py-3">
        {home ? (
          <div className="min-w-0">
            <p className="text-sm text-muted">{config.greetingPrefix}, {name}</p>
            <p className="text-base font-semibold leading-5 text-ink">{config.greetingSubtitle}</p>
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

function AdminLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/login");
  }, [router]);
  return <BrandSplash label="Opening admin sign-in" />;
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, signOutUser } = useAuth();
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(false);
  const [alerts, setAlerts] = useState(0);
  const [alice, setAlice] = useState<{ provider: string; connected: boolean; configured: boolean } | null>(null);
  const [aliceFailed, setAliceFailed] = useState(false);
  const name = state.status === "ready" ? state.me.displayName || "Admin" : "Admin";
  const initial = name.trim().slice(0, 1).toUpperCase() || "A";

  useEffect(() => {
    if (state.status !== "ready") return;
    apiFetch<{ campaigns: unknown[] }>("/api/v1/admin/notifications").then((result) => {
      if (result.ok) setAlerts(result.data.campaigns.length);
    });
    apiFetch<{ provider: string; connected: boolean; configured: boolean }>("/api/v1/admin/market/aliceblue").then((result) => {
      if (result.ok) setAlice(result.data);
    });
    setAliceFailed(new URLSearchParams(window.location.search).get("alice") === "failed");
  }, [state.status]);

  return (
    <div className="admin-light min-h-screen bg-[#f3f7f4] lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="bg-[#083326] text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <div className="flex h-16 items-center px-4">
          <Link href="/admin" aria-label="inStox admin" className="inline-flex rounded-xl bg-white px-2 py-1">
            <Wordmark decorative className="h-9 w-auto" />
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-6" aria-label="Admin">
          {ADMIN_LINKS.filter((link) => {
            if (state.status !== "ready") return !link.superAdmin && !link.crm;
            if (link.superAdmin && !canManageIntegrations(state.me.roles)) return false;
            if (link.crm && !canManageCrm(state.me.roles)) return false;
            return true;
          }).map((link) => {
            const active = link.href === "/admin" ? pathname === "/admin" : pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${active ? "bg-primary text-white" : "text-white/80 hover:bg-white/10"}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">
        {alice?.provider === "aliceblue" && !alice.connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-loss px-4 py-3 text-sm text-white md:px-6">
            <p>
              {alice.configured
                ? "Alice Blue is not connected. Index prices are delayed."
                : "Alice Blue is not configured. Index prices are delayed."}
              {aliceFailed ? " The connect attempt did not finish." : ""}
            </p>
            {alice.configured && state.status === "ready" && canManageOperations(state.me.roles) ? (
              <a className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-loss" href="/api/v1/admin/market/aliceblue/connect">
                Connect Alice Blue
              </a>
            ) : null}
          </div>
        ) : null}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white px-4 md:px-6">
          <form
            className="relative min-w-0 flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              const next = query.trim();
              router.push(next ? `/admin/tips?q=${encodeURIComponent(next)}` : "/admin/tips");
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              className="field h-10 pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users, tips, symbols"
              aria-label="Search users, tips, symbols"
            />
          </form>
          <Link href="/admin/notifications" aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-canvas">
            <Bell className="h-5 w-5" aria-hidden="true" />
            {alerts > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-loss px-1 text-[10px] font-semibold text-white">
                {alerts > 9 ? "9+" : alerts}
              </span>
            ) : null}
          </Link>
          <div className="relative">
            <button type="button" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-canvas" aria-expanded={menu} onClick={() => setMenu((open) => !open)}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">{initial}</span>
              <span className="hidden text-sm font-medium text-ink sm:inline">{name}</span>
            </button>
            {menu ? (
              <div className="absolute right-0 mt-2 w-40 rounded-xl border border-line bg-white p-1 shadow-card">
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
                  onClick={() => void signOutUser().then(() => router.push("/admin/login"))}
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </header>
        <div className="px-4 py-5 md:px-6 md:py-6">{children}</div>
      </div>
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
