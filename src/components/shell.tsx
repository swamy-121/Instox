"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Bookmark,
  ChevronLeft,
  CircleHelp,
  Crown,
  Home,
  Lightbulb,
  LineChart,
  Newspaper,
  Search,
  Settings,
  UserRound,
} from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { useMemberConfig } from "@/features/app/member-config";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { formatIstDay, formatIstStamp, nseSession } from "@/lib/market-session";

const PRIMARY = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/tips", label: "Tips", icon: Lightbulb },
  { href: "/screener", label: "Screener", icon: LineChart },
  { href: "/market", label: "Market", icon: BarChart3 },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/pulse", label: "Pulse & Insights", icon: Activity },
] as const;

const ACCOUNT = [
  { href: "/premium", label: "Premium", icon: Crown },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help & Support", icon: CircleHelp },
] as const;

function active(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home";
  if (href === "/tips") return pathname === "/tips" || /^\/tips\/(?!saved|tracked|recommended|alerts)[^/]+$/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function pageIdentity(pathname: string, symbol: string | null): { title: string; subtitle?: string; back?: string } {
  if (pathname === "/home") return { title: "Home" };
  if (pathname === "/tips") return { title: "Tips", subtitle: "Trading ideas" };
  if (pathname === "/tips/saved") return { title: "Saved ideas", back: "/tips" };
  if (pathname === "/tips/tracked") return { title: "Tracked ideas", back: "/tips" };
  if (pathname === "/tips/recommended") return { title: "Ideas for you", back: "/tips" };
  if (pathname === "/tips/alerts") return { title: "Tip alerts", back: "/tips" };
  if (pathname.startsWith("/tips/")) return { title: "Tip details", back: "/tips" };
  if (pathname === "/screener") return { title: "Screener", subtitle: "Find stocks by criteria" };
  if (pathname === "/news") return { title: "News", subtitle: "Market stories" };
  if (pathname === "/more") return { title: "More" };
  if (pathname === "/market") return symbol ? { title: "Stock details", back: "/market" } : { title: "Market", subtitle: "Indices and movers" };
  if (pathname === "/watchlist") return { title: "Watchlist" };
  if (pathname === "/pulse" || pathname === "/insights") return { title: "Pulse & Insights", subtitle: "Scores and coverage" };
  if (pathname === "/premium" || pathname.startsWith("/premium/")) return { title: "Premium", subtitle: "Plans from the billing source" };
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return { title: "Profile" };
  if (pathname === "/settings") return { title: "Settings" };
  if (pathname === "/help") return { title: "Help & support" };
  if (pathname === "/charts") return { title: "Charts", subtitle: "Sample daily prices" };
  if (pathname === "/shop") return { title: "Shop" };
  if (pathname === "/strategies") return { title: "Strategies" };
  if (pathname === "/backtest") return { title: "Backtest", subtitle: "Practice results, not a forecast" };
  if (pathname === "/levels") return { title: "Support and resistance" };
  if (pathname === "/options") return { title: "Option chain notes" };
  if (pathname === "/tip-check") return { title: "Check a stock" };
  if (pathname === "/referrals") return { title: "Referrals" };
  if (pathname === "/pricing") return { title: "Pricing" };
  if (pathname === "/disclaimer") return { title: "Risk disclosure" };
  if (pathname === "/about") return { title: "About" };
  return { title: "Instox" };
}

function NavLink({ href, label, icon: Icon, pathname }: { href: string; label: string; icon: typeof Home; pathname: string }) {
  const on = active(pathname, href);
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`flex h-10 items-center gap-3 rounded-[9px] px-3 text-[13.5px] ${on ? "bg-primary-soft font-bold text-primary-dark" : "font-medium text-[#3A4741] hover:bg-canvas"}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" strokeWidth={on ? 2.2 : 1.8} />
      {label}
    </Link>
  );
}

export function MemberSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-white px-3.5 py-5 lg:flex">
      <Link href="/home" aria-label="Instox" className="mb-5 inline-flex px-2">
        <Wordmark decorative className="h-8 w-auto" />
      </Link>
      <nav className="flex flex-col gap-0.5" aria-label="Primary">
        {PRIMARY.map((link) => (
          <NavLink key={link.href} {...link} pathname={pathname} />
        ))}
        <p className="mb-1.5 ml-3 mt-4 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8C9891]">Account</p>
        {ACCOUNT.map((link) => (
          <NavLink key={link.href} {...link} pathname={pathname} />
        ))}
      </nav>
      <div className="mt-auto rounded-xl bg-gradient-to-br from-primary-dark to-primary p-3.5 text-white">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Crown className="h-4 w-4" aria-hidden="true" />
          Instox Premium
        </p>
        <p className="mt-1 text-[11px] leading-4 text-white/85">Unlock premium tips and saved screeners.</p>
        <Link href="/premium" className="btn-quiet mt-2.5 w-full bg-white text-primary-dark hover:bg-white">
          View plans
        </Link>
      </div>
    </aside>
  );
}

export function MemberTop() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const config = useMemberConfig();
  const { state } = useAuth();
  const [query, setQuery] = useState("");
  const [unread, setUnread] = useState(0);
  const [session, setSession] = useState(nseSession());
  const identity = pageIdentity(pathname, params.get("symbol"));
  const name = state.status === "ready" ? state.me.displayName || "there" : "there";
  const initial = name.trim().slice(0, 1).toUpperCase() || "I";
  const plan = state.status === "ready" && state.me.entitlement.tier === "premium" ? "Premium" : "Free plan";
  const home = pathname === "/home";
  const title = home ? `${config.greetingPrefix}, ${name}` : identity.title;
  const subtitle = home ? formatIstDay() : identity.subtitle;

  useEffect(() => {
    const timer = window.setInterval(() => setSession(nseSession()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    apiFetch<{ alerts: Array<{ readAt: string | null }> }>("/api/v1/tip-alerts").then((result) => {
      if (result.ok) setUnread(result.data.alerts.filter((row) => !row.readAt).length);
    });
  }, [pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("member-search")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur lg:h-16 lg:bg-white/90 lg:px-7 lg:py-0">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {identity.back ? (
          <Link href={identity.back} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-line bg-white text-ink lg:hidden">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-lg font-bold tracking-tight text-ink">{title}</p>
          {subtitle ? <p className="truncate text-[11px] text-muted">{subtitle}</p> : null}
        </div>
      </div>
      <form
        className="hidden h-[38px] w-[300px] items-center gap-2 rounded-[10px] border border-line bg-canvas px-3 text-[13px] text-muted lg:flex"
        onSubmit={(event) => {
          event.preventDefault();
          const next = query.trim().toUpperCase();
          if (next) router.push(`/market?symbol=${encodeURIComponent(next)}`);
        }}
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <label className="sr-only" htmlFor="member-search">Search stocks</label>
        <input
          id="member-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search stocks, tips, news"
          className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
        />
        <span className="text-[11px] text-muted" aria-hidden="true">⌘K</span>
      </form>
      <span className={`hidden h-[30px] items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold lg:inline-flex ${session.open ? "bg-[#E6F4EC] text-profit" : "bg-[#EEF2EF] text-muted"}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
        {session.label} · NSE
      </span>
      <Link href="/tips/alerts" aria-label={unread ? `Alerts, ${unread} unread` : "Alerts"} className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-line bg-white text-ink">
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 ? <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full border border-white bg-loss" /> : null}
      </Link>
      <Link href="/profile" className="flex items-center gap-2" aria-label="Profile">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-dark text-[13px] font-bold text-white">{initial}</span>
        <span className="hidden leading-tight lg:block">
          <span className="block text-[13px] font-semibold text-ink">{name}</span>
          <span className="block text-[11px] text-muted">{plan}</span>
        </span>
      </Link>
    </header>
  );
}

export function UpdatedLine({ at, sample, note }: { at?: string | null; sample?: boolean; note?: string }) {
  const stamp = at ? formatIstStamp(at) : "";
  return (
    <p className="text-[11px] text-muted">
      {stamp ? `Last updated ${stamp} IST` : "Updated time unavailable"}
      {note ? ` · ${note}` : ""}
      {sample ? " · sample data" : ""}
    </p>
  );
}
