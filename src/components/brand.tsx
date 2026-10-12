"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SplashArt } from "@/components/illustrations";
import { apiFetch } from "@/lib/api-client";

const SPLASH_TAGLINE = "Smart Trading Ideas for a Smarter You";

export function BrandSplash({
  label = "Loading Instox",
  advance = false,
}: {
  label?: string;
  advance?: boolean;
}) {
  const [headline, setHeadline] = useState(SPLASH_TAGLINE);

  useEffect(() => {
    apiFetch<{ records: { id: string; title: string }[] }>("/api/v1/content/contentDocs").then((result) => {
      if (!result.ok) return;
      const title = result.data.records.find((row) => row.id === "splash")?.title?.trim();
      if (title) setHeadline(title);
    });
  }, []);

  return (
    <div className="splash-screen" role="status" aria-label="inStox">
      <div className="splash-logo splash-rise">
        {/* The official file scales by CSS width. next/image locks the intrinsic size. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo.png"
          width={1544}
          height={465}
          alt="inStox, Instant Trading Ideas"
          className="splash-logo-img"
        />
      </div>
      <div className="splash-hero splash-rise splash-rise-delay">
        <SplashArt />
        <p className="splash-tagline">{headline}</p>
      </div>
      <div className="splash-progress" aria-hidden="true">
        <span className={advance ? "splash-progress-fill" : "splash-progress-indeterminate"} />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

const SPLASH_KEY = "instox-splash";
const SPLASH_MS = 2800;

export function SplashGate({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_KEY) === "skip") {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => {
      sessionStorage.setItem(SPLASH_KEY, "skip");
      setVisible(false);
      router.push("/onboarding");
    }, SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <>
      {children}
      {visible ? <BrandSplash label="inStox" advance /> : null}
    </>
  );
}
