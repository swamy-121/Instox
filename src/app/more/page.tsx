"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, Bell, Bookmark, ChevronRight, CircleHelp, Crown, Download, FileText, LineChart, LogOut, Newspaper, Settings, Shield, Star, UserRound } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { Pill } from "@/components/design";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { canAccessAdmin } from "@/server/authorization/roles";

type LinkRow = { id: string; href: string; label: string };

function iconFor(href: string) {
  if (href.includes("watchlist")) return Bookmark;
  if (href.includes("news")) return Newspaper;
  if (href.includes("pulse") || href.includes("insight")) return Activity;
  if (href.includes("market") || href.includes("chart") || href.includes("level")) return LineChart;
  if (href.includes("premium") || href.includes("pricing")) return Crown;
  if (href.includes("profile")) return UserRound;
  if (href.includes("setting") || href.includes("alert")) return Bell;
  if (href.includes("help")) return CircleHelp;
  if (href.includes("disclaimer") || href.includes("about")) return FileText;
  if (href.includes("admin")) return Shield;
  if (href.includes("saved") || href.includes("star")) return Star;
  if (href.includes("shop")) return Download;
  return Settings;
}

const RESEARCH: LinkRow[] = [
  { id: "saved", href: "/tips/saved", label: "Saved ideas" },
  { id: "recommended", href: "/tips/recommended", label: "Ideas for you" },
  { id: "tracked", href: "/tips/tracked", label: "Tracked ideas" },
  { id: "alerts", href: "/tips/alerts", label: "Tip alerts" },
  { id: "check", href: "/tip-check", label: "Check a stock" },
  { id: "pulse", href: "/pulse", label: "Pulse" },
  { id: "levels", href: "/levels", label: "Support and resistance" },
  { id: "options", href: "/options", label: "Option chain notes" },
  { id: "backtest", href: "/backtest", label: "Practice backtest" },
];

export default function MorePage() {
  return (
    <AppFrame requireAuth>
      <MoreBody />
    </AppFrame>
  );
}

function MoreBody() {
  const { state, signOutUser } = useAuth();
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    apiFetch<{ records: LinkRow[] }>("/api/v1/content/moreLinks").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setLinks(result.data.records);
    });
  }

  useEffect(() => {
    if (state.status === "ready") load();
  }, [state.status]);

  if (state.status !== "ready") return null;
  const admin = canAccessAdmin(state.me.roles);
  const hrefs = new Set((links ?? []).map((link) => link.href));
  const extra = links || error ? RESEARCH.filter((link) => !hrefs.has(link.href)) : [];
  const combined = [...(links ?? []), ...extra, ...(admin ? [{ id: "admin", href: "/admin", label: "Admin" }] : [])];
  const groups = [
    { title: "Market & Research", items: combined.filter((link) => /market|watchlist|pulse|news|insight|chart|level|option|tip-check|backtest|screener/.test(link.href)) },
    { title: "Ideas", items: combined.filter((link) => link.href.startsWith("/tips")) },
    { title: "My Account", items: combined.filter((link) => /profile|settings|referral|admin/.test(link.href)) },
    { title: "Premium", items: combined.filter((link) => /premium|pricing|shop/.test(link.href)) },
    { title: "Help", items: combined.filter((link) => /help|disclaimer|about/.test(link.href)) },
  ];
  const used = new Set(groups.flatMap((group) => group.items.map((item) => item.href)));
  const rest = combined.filter((link) => !used.has(link.href));
  if (rest.length) groups.push({ title: "Also", items: rest });
  const name = state.me.displayName || "Member";
  const initial = name.trim().slice(0, 1).toUpperCase() || "I";
  const premium = state.me.entitlement.tier === "premium";

  return (
    <div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!links && !error ? <LoadingState label="Loading menu" /> : null}
      <div className="card flex items-center gap-3 !p-3.5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-dark text-base font-bold text-white">{initial}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-ink">{name}</span>
          <span className="block text-[11px] text-muted">{state.me.phoneNumber ?? state.me.email ?? "No contact linked"}</span>
        </span>
        <Pill tone={premium ? "brand" : "amber"}>{premium ? "Premium" : "Free plan"}</Pill>
      </div>
      {premium ? null : (
        <Link href="/premium" className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-gradient-to-br from-primary-dark to-primary p-3.5 text-white">
          <span>
            <span className="flex items-center gap-2 text-sm font-bold"><Crown className="h-4 w-4" aria-hidden="true" />Upgrade to Premium</span>
            <span className="mt-0.5 block text-[11px] text-white/85">See plans, prices and what&apos;s included</span>
          </span>
          <span className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-primary-dark">View plans</span>
        </Link>
      )}
      {groups.map((group) => group.items.length === 0 ? null : (
        <section key={group.title}>
          <h2 className="mb-2 ml-1 mt-4 text-[11px] font-medium uppercase tracking-wide text-muted">{group.title}</h2>
          <ul className="card divide-y divide-line !p-0">
            {group.items.map((link) => {
              const Icon = iconFor(link.href);
              return (
                <li key={link.id}>
                  <Link href={link.href} className="flex min-h-11 items-center justify-between gap-3 px-3.5 py-2.5">
                    <span className="flex items-center gap-3 text-sm font-semibold text-ink">
                      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      {link.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {links && links.length === 0 && extra.length === 0 ? <div className="mt-3"><EmptyState title="No links" body="Nothing here yet." /></div> : null}
      <button type="button" className="card mt-4 flex w-full items-center gap-3 !p-3 text-sm font-semibold text-loss" onClick={() => void signOutUser()}>
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#FCEBEB]">
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </span>
        Log out
      </button>
    </div>
  );
}
