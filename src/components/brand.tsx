"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { apiFetch } from "@/lib/api-client";

export function BrandSplash({
  label = "Loading Instox",
  onSkip,
}: {
  label?: string;
  onSkip?: () => void;
}) {
  const skipRef = useRef<HTMLButtonElement>(null);
  const [headline, setHeadline] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    skipRef.current?.focus();
    apiFetch<{ records: { id: string; title: string }[] }>("/api/v1/content/contentDocs").then((result) => {
      if (!result.ok) {
        setCopyError(result.message);
        return;
      }
      setHeadline(result.data.records.find((row) => row.id === "splash")?.title ?? "");
    });
  }, []);

  return (
    <div
      className="brand-surface fixed inset-0 z-50 flex flex-col"
      role={onSkip ? "dialog" : "status"}
      aria-label="inStox"
      aria-live={onSkip ? undefined : "polite"}
    >
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <Wordmark className="h-auto w-[min(88vw,520px)]" />
        <BullMark />
        {headline ? <p className="mt-6 max-w-xs text-center text-base font-medium text-ink">{headline}</p> : null}
        {headline === "" ? <p className="mt-6 text-sm text-muted">Splash copy has not been published.</p> : null}
        {copyError ? <p className="mt-6 text-sm text-loss" role="alert">{copyError}</p> : null}
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

function BullMark() {
  return (
    <svg viewBox="0 0 160 90" className="mt-8 h-24 w-40 text-primary" aria-hidden="true">
      <path fill="currentColor" d="M18 70c8-18 16-28 28-32 4 8 6 14 6 22 8-16 20-28 40-34 2 10 2 18 0 28 10-6 22-8 36-6-2 8-8 14-16 18 8 2 14 8 16 16H28c0-6-4-10-10-12Z" />
      <path fill="currentColor" d="M78 62h8v16h-8zM92 50h8v28h-8zM106 40h8v38h-8z" opacity="0.85" />
    </svg>
  );
}

export function SplashGate({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const router = useRouter();

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
            router.push("/onboarding");
          }}
        />
      ) : null}
    </>
  );
}
