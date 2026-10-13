"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/wordmark";
import { useAuth, useSignedInRedirect } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { toE164 } from "@/lib/phone";

const RESEND_SECONDS = 30;
const OTP_SECONDS = 5 * 60;

export default function PhoneSignInPage() {
  const { refresh } = useAuth();
  useSignedInRedirect();
  const [countryCode, setCountryCode] = useState("91");
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preset = params.get("national");
    if (preset) setNational(preset);
    // The first sign-in screen already sent the code, so open on the code step.
    if (preset && params.get("sent") === "1") {
      const sentPhone = toE164("91", preset);
      if (sentPhone) {
        setPhone(sentPhone);
        setStep("otp");
        setResendIn(RESEND_SECONDS);
        setExpiresIn(OTP_SECONDS);
        setNotice(params.get("delivery") === "dev" ? "Test mode: check the app log for your code." : "We've sent a code to your phone.");
      }
    }
  }, []);

  useEffect(() => {
    if (resendIn <= 0 && expiresIn <= 0) return;
    const timer = window.setInterval(() => {
      setResendIn((value) => Math.max(0, value - 1));
      setExpiresIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendIn, expiresIn]);

  async function sendCode() {
    const nextPhone = toE164(countryCode, national);
    if (!nextPhone) {
      setError("Enter a valid phone number. Indian numbers are 10 digits starting from 6 to 9.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await apiFetch<{ sent: boolean; delivery: "dev" | "apitxt" }>("/api/v1/auth/otp/start", {
      method: "POST",
      body: JSON.stringify({ phone: nextPhone }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPhone(nextPhone);
    setStep("otp");
    setCode("");
    setResendIn(RESEND_SECONDS);
    setExpiresIn(OTP_SECONDS);
    setNotice(result.data.delivery === "dev" ? "Test mode: check the app log for your code." : "We've sent a code to your phone.");
  }

  async function verifyCode() {
    if (!phone) {
      setError("Send yourself a code first.");
      return;
    }
    if (expiresIn === 0) {
      setError("That code has expired. Send a new one.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Please enter the 6 digit code.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await apiFetch<{ uid: string; emailConflict: boolean }>("/api/v1/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    });
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }
    setCode("");
    await refresh({ emailConflict: result.data.emailConflict });
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Link href="/" aria-label="inStox" className="inline-flex">
        <Wordmark decorative className="h-12 w-auto" />
      </Link>
      <Link href="/sign-in" className="mt-6 block text-sm text-muted">
        Back
      </Link>
      <h1 className="mt-4 text-3xl font-semibold text-navy">{step === "phone" ? "Phone number" : "Enter the code"}</h1>
      {step === "phone" ? (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
        >
          <label className="label" htmlFor="country">Country code</label>
          <input id="country" className="field" inputMode="numeric" value={countryCode} onChange={(event) => setCountryCode(event.target.value)} />
          <label className="label" htmlFor="phone">Phone number</label>
          <input id="phone" className="field" inputMode="tel" autoComplete="tel" value={national} onChange={(event) => setNational(event.target.value)} />
          <p className="text-xs text-muted">We&apos;ll text you a 6 digit code. It&apos;s only used to sign you in.</p>
          <button className="btn-primary w-full" type="submit" disabled={busy}>{busy ? "Sending" : "Send code"}</button>
        </form>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void verifyCode();
          }}
        >
          <p className="text-sm text-muted" id="otp-label">6 digit code</p>
          <div className="grid grid-cols-6 gap-2" role="group" aria-labelledby="otp-label">
            {Array.from({ length: 6 }, (_, index) => (
              <input key={index} className="field px-0 text-center tabular-nums" inputMode="numeric" maxLength={1} value={code[index] ?? ""} readOnly />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) => (
              <button
                key={key || "blank"}
                type="button"
                className="btn-quiet"
                disabled={!key}
                onClick={() => {
                  if (key === "del") setCode((value) => value.slice(0, -1));
                  else if (code.length < 6) setCode((value) => `${value}${key}`);
                }}
              >
                {key === "del" ? "Del" : key}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">Code timer: {Math.floor(expiresIn / 60)}:{String(expiresIn % 60).padStart(2, "0")}</p>
          {notice ? <p className="text-sm text-muted" role="status">{notice}</p> : null}
          <button className="btn-primary w-full" type="submit" disabled={busy}>{busy ? "Checking" : "Verify"}</button>
          <button type="button" className="btn-secondary w-full" disabled={busy || resendIn > 0} onClick={() => void sendCode()}>
            {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
          </button>
          <button type="button" className="text-sm underline" onClick={() => { setStep("phone"); setCode(""); }}>
            Edit phone number
          </button>
        </form>
      )}
      {error ? <p className="mt-4 text-sm text-ink" role="alert">{error}</p> : null}
    </main>
  );
}
