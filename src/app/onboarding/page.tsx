"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingArt } from "@/components/illustrations";
import { Wordmark } from "@/components/wordmark";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiFetch } from "@/lib/api-client";

type Slide = { id: string; title: string; body: string; icon: string; sort: number };

export default function OnboardingPage() {
  const router = useRouter();
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  function load() {
    setError(null);
    apiFetch<{ records: Slide[] }>("/api/v1/content/onboardingSlides").then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSlides(result.data.records);
    });
  }

  useEffect(() => {
    load();
  }, []);

  const slide = slides?.[index];
  const last = slides ? index >= slides.length - 1 : false;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-white px-6 py-6">
      <div className="flex items-center justify-between">
        <Wordmark decorative className="h-10 w-auto" />
        <Link href="/sign-in" className="text-sm font-medium text-muted">Skip</Link>
      </div>
      {error ? <div className="mt-8"><ErrorState message={error} onRetry={load} /></div> : null}
      {!slides && !error ? <div className="mt-8"><LoadingState label="Loading onboarding" /></div> : null}
      {slides && slides.length === 0 ? <div className="mt-8"><EmptyState title="No slides" body="Publish onboarding slides to show this carousel." /></div> : null}
      {slide ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <OnboardingArt icon={slide.icon} />
          <h1 className="mt-8 text-2xl font-semibold text-ink">{slide.title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{slide.body}</p>
        </div>
      ) : <div className="flex-1" />}
      <div className="flex items-center justify-center gap-2 py-4">
        {(slides ?? []).map((item, dot) => (
          <span key={item.id} className={`h-2 w-2 rounded-full ${dot === index ? "bg-primary" : "bg-line"}`} />
        ))}
      </div>
      <button
        type="button"
        className="btn-primary w-full"
        disabled={!slide}
        onClick={() => {
          if (!slides || last) {
            router.push("/sign-in");
            return;
          }
          setIndex((value) => value + 1);
        }}
      >
        {last ? "Continue" : "Next"}
      </button>
    </main>
  );
}
