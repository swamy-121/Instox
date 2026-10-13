"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { toE164 } from "@/lib/phone";

export function PhoneStart({ idPrefix = "phone" }: { idPrefix?: string }) {
  const [national, setNational] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const fieldId = `${idPrefix}-mobile`;

  async function sendCode() {
    const phone = toE164("91", national);
    if (!phone) {
      setError("Enter a valid phone number. Indian numbers are 10 digits starting from 6 to 9.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await apiFetch<{ sent: boolean; delivery: "dev" | "apitxt" }>("/api/v1/auth/otp/start", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
    if (!result.ok) {
      setBusy(false);
      setError(result.message);
      return;
    }
    const params = new URLSearchParams({ national: national.trim(), sent: "1", delivery: result.data.delivery });
    router.push(`/sign-in/phone?${params.toString()}`);
  }

  return (
    <div>
      <label className="label" htmlFor={fieldId}>Mobile number</label>
      <div className="flex h-12 overflow-hidden rounded-[10px] border-[1.5px] border-primary bg-white focus-within:ring-4 focus-within:ring-primary-soft">
        <span className="inline-flex items-center border-r border-line bg-canvas px-3 text-sm font-semibold text-ink">+91</span>
        <input
          id={fieldId}
          className="num min-w-0 flex-1 bg-transparent px-3 text-[15px] tracking-wide text-ink outline-none"
          inputMode="numeric"
          autoComplete="tel"
          value={national}
          onChange={(event) => setNational(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void sendCode();
            }
          }}
          placeholder="10 digit mobile"
        />
      </div>
      <button type="button" className="btn-primary mt-3.5 h-12 w-full" disabled={busy} onClick={() => void sendCode()}>
        {busy ? "Sending" : "Get OTP"}
      </button>
      {error ? <p className="mt-3 text-sm text-ink" role="alert">{error}</p> : null}
      <p className="mt-3 text-center text-[11px] text-muted">
        By continuing you agree to the <Link href="/disclaimer" className="font-semibold text-primary">Terms</Link> and <Link href="/disclaimer" className="font-semibold text-primary">Privacy Policy</Link>.
      </p>
    </div>
  );
}
