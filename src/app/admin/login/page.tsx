"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandSplash } from "@/components/brand";
import { Wordmark } from "@/components/wordmark";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { canAccessAdmin } from "@/server/authorization/roles";

export default function AdminLoginPage() {
  const { state, refresh } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [resetToken, setResetToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("reset") ?? "";
    if (token) setResetToken(token);
  }, []);

  useEffect(() => {
    if (state.status === "ready" && canAccessAdmin(state.me.roles) && state.me.status === "active" && state.me.profileComplete) {
      router.replace("/admin");
    }
  }, [router, state]);

  if (state.status === "loading") return <BrandSplash label="Checking session" />;

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await apiFetch("/api/v1/auth/password", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), password, remember }),
    });
    if (!result.ok) {
      setMessage(result.message);
      setBusy(false);
      return;
    }
    await refresh();
    setBusy(false);
  }

  async function forgot() {
    if (!email.trim()) {
      setMessage("Enter your email, then choose forgot password.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await apiFetch<{ message: string }>("/api/v1/auth/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email: email.trim() }),
    });
    setMessage(result.ok ? result.data.message : result.message);
    setBusy(false);
  }

  async function reset(event: React.FormEvent) {
    event.preventDefault();
    if (password !== nextPassword) {
      setMessage("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await apiFetch("/api/v1/auth/password/reset", {
      method: "POST",
      body: JSON.stringify({ token: resetToken, password }),
    });
    if (!result.ok) {
      setMessage(result.message);
      setBusy(false);
      return;
    }
    setResetToken("");
    setPassword("");
    setNextPassword("");
    setMessage("Password updated. Sign in with the new password.");
    window.history.replaceState(null, "", "/admin/login");
    setBusy(false);
  }

  const blocked = state.status === "ready" && !canAccessAdmin(state.me.roles);

  return (
    <main className="admin-light grid min-h-screen bg-canvas lg:grid-cols-2">
      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-lg border border-line bg-white p-6">
          <Wordmark className="h-12 w-auto" />
          <h1 className="mt-6 text-xl font-semibold text-ink">{resetToken ? "Reset password" : "Admin sign-in"}</h1>
          <p className="mt-1 text-sm text-muted">{resetToken ? "Choose a new password for this admin account." : "Staff email and password."}</p>
          {blocked ? <p className="mt-4 text-sm text-ink">This sign-in does not include an admin role.</p> : null}
          {resetToken ? (
            <form className="mt-6 space-y-4" onSubmit={(event) => void reset(event)}>
              <label className="block">
                <span className="label">New password</span>
                <input className="field" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>
              <label className="block">
                <span className="label">Confirm password</span>
                <input className="field" type="password" autoComplete="new-password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} required />
              </label>
              {message ? <p className="text-sm text-ink" role="status">{message}</p> : null}
              <button className="btn-primary w-full" type="submit" disabled={busy}>{busy ? "Saving" : "Save password"}</button>
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={(event) => void login(event)}>
              <label className="block">
                <span className="label">Email</span>
                <input className="field" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <label className="block">
                <span className="label">Password</span>
                <input className="field" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-ink">
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                  Remember me
                </label>
                <button type="button" className="font-medium text-primary" onClick={() => void forgot()}>Forgot password?</button>
              </div>
              {message ? <p className="text-sm text-ink" role="status">{message}</p> : null}
              <button className="btn-primary w-full" type="submit" disabled={busy}>{busy ? "Signing in" : "Sign in"}</button>
            </form>
          )}
        </div>
      </section>
      <section className="hidden flex-col justify-end bg-navy px-12 py-16 text-white lg:flex">
        <p className="text-sm text-white/70">Instox desk</p>
        <p className="mt-2 max-w-sm text-2xl font-semibold leading-snug">Ideas, accounts, and recorded orders.</p>
      </section>
    </main>
  );
}
