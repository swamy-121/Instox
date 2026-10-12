"use client";

import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ErrorState } from "@/components/states";
import { Wordmark } from "@/components/wordmark";
import { useAuth, useSignedInRedirect } from "@/features/auth/auth-provider";
import { getClientAuth } from "@/lib/firebase-client";
import { toE164 } from "@/lib/phone";

const RESEND_SECONDS = 30;
const OTP_SECONDS = 5 * 60;

export default function PhoneSignInPage() {
  const { state } = useAuth();
  useSignedInRedirect();
  const [countryCode, setCountryCode] = useState("91");
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preset = params.get("national");
    if (preset) setNational(preset);
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
    const auth = getClientAuth();
    if (!auth) return;
    const phone = toE164(countryCode, national);
    if (!phone) {
      setError("Enter a valid phone number. Indian numbers are 10 digits starting from 6 to 9.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!verifier.current) {
        verifier.current = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      }
      confirmation.current = await signInWithPhoneNumber(auth, phone, verifier.current);
      setStep("otp");
      setResendIn(RESEND_SECONDS);
      setExpiresIn(OTP_SECONDS);
    } catch (caught) {
      const codeName = caught && typeof caught === "object" && "code" in caught ? String(caught.code) : "";
      if (codeName === "auth/too-many-requests") setError("Too many attempts. Wait and try again.");
      else if (codeName === "auth/invalid-phone-number") setError("That phone number was rejected.");
      else setError("The code could not be sent. Try again in a moment.");
      verifier.current?.clear();
      verifier.current = null;
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!confirmation.current) {
      setError("Request a code first.");
      return;
    }
    if (expiresIn === 0) {
      setError("That code has expired. Send a new one.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await confirmation.current.confirm(code.trim());
    } catch (caught) {
      const codeName = caught && typeof caught === "object" && "code" in caught ? String(caught.code) : "";
      if (codeName === "auth/invalid-verification-code") setError("That code is not valid.");
      else if (codeName === "auth/code-expired") setError("That code has expired. Send a new one.");
      else if (codeName === "auth/too-many-requests") setError("Too many attempts. Wait and try again.");
      else setError("The code could not be checked.");
    } finally {
      setBusy(false);
    }
  }

  if (state.status === "unconfigured") {
    return <main className="mx-auto max-w-md px-4 py-10"><ErrorState message="Firebase is not configured." /></main>;
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
      <div id="recaptcha-container" />
      {step === "phone" ? (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
        >
          <label className="label" htmlFor="country">
            Country code
          </label>
          <input id="country" className="field" inputMode="numeric" value={countryCode} onChange={(event) => setCountryCode(event.target.value)} />
          <label className="label" htmlFor="phone">
            Phone number
          </label>
          <input id="phone" className="field" inputMode="tel" autoComplete="tel" value={national} onChange={(event) => setNational(event.target.value)} />
          <p className="text-xs text-muted">By continuing you agree to receive a one-time code for sign-in. The code is not stored by Instox.</p>
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Sending" : "Send code"}
          </button>
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
              <input
                key={index}
                className="field px-0 text-center tabular-nums"
                inputMode="numeric"
                maxLength={1}
                value={code[index] ?? ""}
                readOnly
              />
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
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Checking" : "Verify"}
          </button>
          <button type="button" className="btn-secondary w-full" disabled={busy || resendIn > 0} onClick={() => void sendCode()}>
            {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
          </button>
          <button type="button" className="text-sm underline" onClick={() => setStep("phone")}>
            Edit phone number
          </button>
        </form>
      )}
      {error ? <p className="mt-4 text-sm text-ink" role="alert">{error}</p> : null}
    </main>
  );
}
