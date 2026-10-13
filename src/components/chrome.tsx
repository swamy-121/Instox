"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, LayoutGrid, Lightbulb, LineChart, Newspaper } from "lucide-react";
import { Wordmark } from "@/components/wordmark";

const MEMBER_LINKS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/tips", label: "Tips", icon: Lightbulb },
  { href: "/screener", label: "Screener", icon: LineChart },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/more", label: "More", icon: LayoutGrid },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="Instox" className="inline-flex shrink-0 items-center">
          <Wordmark decorative className="h-8 w-auto" />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-muted md:flex">
          <Link href="/#features" className="hover:text-ink">Features</Link>
          <Link href="/premium" className="hover:text-ink">Premium</Link>
          <Link href="/help" className="hover:text-ink">Help</Link>
        </nav>
        <Link href="/sign-in" className="btn-primary">
          Sign in
        </Link>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-white px-4 py-10 text-sm text-muted">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <Wordmark decorative className="h-10 w-auto" />
          <p className="mt-3 max-w-sm leading-6">
            Ideas are written by our research team for information only. Instox doesn&apos;t place trades for you and doesn&apos;t promise returns.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/pricing" className="hover:text-ink">Pricing</Link>
          <Link href="/shop" className="hover:text-ink">Shop</Link>
          <Link href="/about" className="hover:text-ink">About</Link>
          <Link href="/disclaimer" className="hover:text-ink">Risk disclosure</Link>
        </div>
      </div>
    </footer>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white lg:hidden" aria-label="Primary" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="mx-auto grid h-[4.75rem] max-w-lg grid-cols-5 px-1.5 pt-2">
        {MEMBER_LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`flex h-11 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? "font-bold text-primary" : "font-medium text-muted"}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-[22px] w-[22px]" aria-hidden="true" strokeWidth={active ? 2.2 : 1.8} />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="Primary">
      {MEMBER_LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-3 py-1.5 ${active ? "bg-primary-soft font-semibold text-primary" : "text-ink hover:bg-canvas"}`}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ServiceWorkerRegistration() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let worker: ServiceWorker | null = null;
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      const track = (installing: ServiceWorker | null) => {
        if (!installing) return;
        worker = installing;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      };
      track(registration.installing);
      registration.addEventListener("updatefound", () => track(registration.installing));
    }).catch(() => {
      // A failed registration should not block the app.
    });
    return () => {
      void worker;
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 rounded-card border border-line bg-white p-4 shadow-card md:bottom-4 md:left-auto md:right-4 md:w-80">
      <p className="text-sm text-ink">A new version is ready.</p>
      <button
        type="button"
        className="btn-primary mt-3"
        onClick={() => {
          navigator.serviceWorker.controller?.postMessage("SKIP_WAITING");
          window.location.reload();
        }}
      >
        Reload
      </button>
    </div>
  );
}
