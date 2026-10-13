"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandSplash } from "@/components/brand";
import { ErrorState } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";

export default function ProfileCompletePage() {
  const { state, refresh } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [consent, setConsent] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await apiFetch("/api/v1/me", {
      method: "PATCH",
      body: JSON.stringify({
        displayName,
        timezone,
        locale: "en-IN",
        consentAccepted: consent,
      }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setFields(result.fields ?? {});
      return;
    }
    await refresh();
    router.replace("/home");
  }

  if (state.status === "loading") return <BrandSplash label="Loading profile" />;
  if (state.status !== "ready") {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <ErrorState message="Please sign in to finish your profile." />
        <Link href="/sign-in" className="btn-primary mt-4">Sign in</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-semibold text-navy">Finish your profile</h1>
      <p className="mt-2 text-sm text-muted">We only save your name, timezone and that you've read the risk disclosure.</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" className="field" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          {fields.displayName ? <p className="mt-1 text-sm text-ink">{fields.displayName}</p> : null}
        </div>
        <div>
          <label className="label" htmlFor="tz">Timezone</label>
          <select id="tz" className="field" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            <option value="Asia/Kolkata">Asia/Kolkata</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>
            I have read the <Link href="/disclaimer" className="underline">risk disclosure</Link> and understand tips are not a promise of returns.
          </span>
        </label>
        {fields.consentAccepted ? <p className="text-sm text-ink">{fields.consentAccepted}</p> : null}
        {error ? <p className="text-sm text-ink" role="alert">{error}</p> : null}
        <button className="btn-primary w-full" type="submit" disabled={busy}>
          {busy ? "Saving" : "Continue"}
        </button>
      </form>
    </main>
  );
}
