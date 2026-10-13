"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Contact,
  CreditCard,
  Crown,
  ClipboardList,
  Handshake,
  KeyRound,
  LayoutDashboard,
  Menu,
  Ruler,
  Phone,
  LifeBuoy,
  LineChart,
  Megaphone,
  Newspaper,
  ScrollText,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import { BrandSplash } from "@/components/brand";
import { BottomNav, PublicFooter, PublicHeader } from "@/components/chrome";
import { MemberSidebar, MemberTop } from "@/components/shell";
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
  { href: "/admin/levels", label: "Support levels", icon: Ruler },
  { href: "/admin/affiliates", label: "Affiliates", icon: Handshake },
  { href: "/admin/tip-check", label: "Tip checks", icon: ClipboardList },
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
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
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
            <p className="mt-2 text-sm leading-6 text-muted">Please sign in to see this page.</p>
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
                ? "Your account is turned off. Please contact support if you think this is a mistake."
                : "Your request to delete the account is being processed, so access is paused for now."
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
          <PermissionDenied message="You don't have admin access." />
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
  const body = config.maintenance ? (
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
  );

  if (!signedIn) {
    return (
      <div className="min-h-screen bg-canvas">
        <PublicHeader />
        <main className="mx-auto w-full max-w-5xl px-4 py-6">{body}</main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <MemberSidebar />
      <div className="min-w-0">
        <Suspense fallback={<div className="h-16 border-b border-line bg-canvas" />}>
          <MemberTop />
        </Suspense>
        <main className="mx-auto w-full max-w-[1192px] px-4 pb-24 pt-3 lg:px-7 lg:pb-10 lg:pt-6">{body}</main>
        {!config.maintenance ? <BottomNav /> : null}
      </div>
    </div>
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
  const [drawer, setDrawer] = useState(false);
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

  const visibleLinks = ADMIN_LINKS.filter((link) => {
    if (state.status !== "ready") return !link.superAdmin && !link.crm;
    if (link.superAdmin && !canManageIntegrations(state.me.roles)) return false;
    if (link.crm && !canManageCrm(state.me.roles)) return false;
    return true;
  });
  const systemHrefs = new Set(["/admin/analytics", "/admin/notifications", "/admin/advertisements", "/admin/member", "/admin/settings", "/admin/integrations", "/admin/support", "/admin/audit"]);

  function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
    const groups = [
      { label: "Admin", links: visibleLinks.filter((link) => !systemHrefs.has(link.href)) },
      { label: "System", links: visibleLinks.filter((link) => systemHrefs.has(link.href)) },
    ];
    return (
      <nav className="flex flex-col" aria-label="Admin">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 ml-3 mt-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8C9891]">{group.label}</p>
            {group.links.map((link) => {
              const on = link.href === "/admin" ? pathname === "/admin" : pathname === link.href || pathname.startsWith(`${link.href}/`);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onNavigate}
                  className={`flex h-10 items-center gap-3 rounded-[9px] px-3 text-[13.5px] ${on ? "bg-primary-soft font-bold text-primary-dark" : "font-medium text-[#3A4741] hover:bg-canvas"}`}
                  aria-current={on ? "page" : undefined}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={on ? 2.2 : 1.8} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <div className="admin-light min-h-screen bg-canvas lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-white px-3.5 py-5 lg:flex">
        <Link href="/admin" aria-label="Instox admin" className="mb-2 inline-flex px-2">
          <Wordmark decorative className="h-8 w-auto" />
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AdminNav />
        </div>
        <div className="mt-3 rounded-xl border border-line p-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF4D6] px-2 py-0.5 text-[11px] font-semibold text-[#9A6700]">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            Production
          </span>
          <p className="mt-1.5 text-[11px] text-muted">Role checks stay on the server. Actions are logged.</p>
        </div>
      </aside>
      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-ink/45" aria-label="Close admin menu" onClick={() => setDrawer(false)} />
          <aside role="dialog" aria-label="Admin menu" className="absolute inset-y-0 left-0 flex w-[292px] flex-col bg-white px-3 py-4 shadow-card">
            <div className="mb-2 flex items-center justify-between px-1.5">
              <Wordmark decorative className="h-7 w-auto" />
              <button type="button" className="flex h-9 w-9 items-center justify-center rounded-[10px] text-ink" aria-label="Close" onClick={() => setDrawer(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-line px-3 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-dark text-[11px] font-bold text-white">{initial}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{name}</span>
                <span className="block text-[11px] text-muted">Admin</span>
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AdminNav onNavigate={() => setDrawer(false)} />
            </div>
          </aside>
        </div>
      ) : null}
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
          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-line lg:hidden" aria-label="Open admin menu" onClick={() => setDrawer(true)}>
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="hidden min-w-0 lg:block">
            <p className="text-lg font-bold tracking-tight text-ink">Admin</p>
          </div>
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
