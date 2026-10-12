"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Wordmark } from "@/components/wordmark";

export function BrandSplash({
  label = "Loading Instox",
  onSkip,
}: {
  label?: string;
  onSkip?: () => void;
}) {
  const skipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    skipRef.current?.focus();
  }, []);

  return (
    <div
      className="brand-surface fixed inset-0 z-50 flex flex-col"
      role={onSkip ? "dialog" : "status"}
      aria-label="inStox"
      aria-live={onSkip ? undefined : "polite"}
    >
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <Wordmark className="h-auto w-[min(78vw,420px)]" />
        <p className="mt-6 text-center text-sm tracking-wide text-muted">Instant Trading ideas</p>
        <span className="sr-only">{label}</span>
      </div>
      {onSkip ? (
        <div className="flex justify-end px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <button
            ref={skipRef}
            type="button"
            className="rounded-full border border-line bg-canvas px-5 py-2 text-sm font-medium text-ink shadow-card"
            onClick={onSkip}
          >
            Skip
          </button>
        </div>
      ) : null}
    </div>
  );
}

const SPLASH_KEY = "instox-splash";

export function SplashGate({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_KEY) === "skip") setVisible(false);
  }, []);

  return (
    <>
      {children}
      {visible ? (
        <BrandSplash
          label="inStox"
          onSkip={() => {
            sessionStorage.setItem(SPLASH_KEY, "skip");
            setVisible(false);
          }}
        />
      ) : null}
    </>
  );
}
