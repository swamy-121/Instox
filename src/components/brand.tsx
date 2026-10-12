"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function BrandSplash({
  label = "Loading Instox",
  advance = false,
}: {
  label?: string;
  advance?: boolean;
}) {
  return (
    <div className="splash-screen" role="status" aria-label="Loading Market Insights">
      <div className="splash-frame">
        <picture>
          <source srcSet="/brand/splash.avif" type="image/avif" />
          <source srcSet="/brand/splash.webp" type="image/webp" />
          {/* The artwork is a full-bleed file. next/image would crop it to a fixed box. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/splash.png"
            width={853}
            height={1844}
            alt=""
            className="splash-photo"
          />
        </picture>
        <div className="splash-bar" aria-hidden="true">
          <span className={advance ? "splash-bar-fill" : "splash-bar-indeterminate"} />
        </div>
      </div>
      <span className="sr-only">{label}. Loading Market Insights.</span>
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
