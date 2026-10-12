"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/wordmark";

const MEMBER_LINKS = [
  { href: "/home", label: "Home" },
  { href: "/tips", label: "Tips" },
  { href: "/screener", label: "Screener" },
  { href: "/insights", label: "Insights" },
  { href: "/profile", label: "Profile" },
];

export function PublicHeader() {
  return (
    <header className="brand-surface border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" aria-label="inStox" className="inline-flex shrink-0 items-center">
          <Wordmark decorative />
        </Link>
        <nav className="flex items-center gap-4 text-sm text-ink">
          <Link href="/pricing" className="hover:underline">
            Pricing
          </Link>
          <Link href="/about" className="hover:underline">
            About
          </Link>
          <Link href="/sign-in" className="rounded-full bg-ink px-3 py-1.5 font-medium text-white hover:bg-ink-hover">
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-12 border-t border-line px-4 py-8 text-sm text-muted">
      <div className="mx-auto flex max-w-5xl flex-wrap gap-4">
        <Link href="/disclaimer" className="hover:underline">
          Risk disclosure
        </Link>
        <Link href="/about" className="hover:underline">
          About
        </Link>
        <Link href="/pricing" className="hover:underline">
          Pricing
        </Link>
      </div>
      <p className="mx-auto mt-4 max-w-5xl">
        Tips are manually written information. Instox does not place trades and does not promise returns.
      </p>
    </footer>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white md:hidden" aria-label="Primary">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {MEMBER_LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`flex h-14 items-center justify-center text-xs font-medium ${active ? "text-primary" : "text-muted"}`}
                aria-current={active ? "page" : undefined}
              >
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
    <nav className="hidden gap-5 text-sm md:flex" aria-label="Primary">
      {MEMBER_LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link key={link.href} href={link.href} className={active ? "font-semibold text-primary" : "text-ink"} aria-current={active ? "page" : undefined}>
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
