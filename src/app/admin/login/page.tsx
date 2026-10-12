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
    <main className="admin-light grid min-h-screen bg-[#e7f6ee] lg:grid-cols-2">
      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-card">
          <Wordmark className="h-14 w-auto" />
          <h1 className="mt-6 text-2xl font-semibold text-ink">{resetToken ? "Reset password" : "Admin Login"}</h1>
          <p className="mt-1 text-sm text-muted">{resetToken ? "Choose a new password for this admin account." : "Access your Instox admin panel"}</p>
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
              <button className="btn-primary w-full" type="submit" disabled={busy}>{busy ? "Signing in" : "Login"}</button>
            </form>
          )}
        </div>
      </section>
      <section className="hidden items-center justify-center px-10 lg:flex" aria-hidden="true">
        <LoginChart />
      </section>
    </main>
  );
}

function LoginChart() {
  return (
    <svg viewBox="0 0 420 320" className="w-full max-w-lg">
      <rect x="24" y="24" width="372" height="272" rx="28" fill="#ffffff" />
      <path d="M56 220 C 110 210, 140 150, 180 156 C 230 164, 250 90, 300 104 C 340 114, 350 70, 372 78" fill="none" stroke="#027332" strokeWidth="4" />
      <path d="M56 220 C 110 210, 140 150, 180 156 C 230 164, 250 90, 300 104 C 340 114, 350 70, 372 78 L 372 240 L 56 240 Z" fill="#027332" opacity="0.16" />
      <rect x="70" y="180" width="28" height="60" rx="6" fill="#8FD19A" />
      <rect x="114" y="150" width="28" height="90" rx="6" fill="#027332" />
      <rect x="158" y="168" width="28" height="72" rx="6" fill="#8FD19A" />
      <rect x="202" y="120" width="28" height="120" rx="6" fill="#027332" />
      <rect x="246" y="140" width="28" height="100" rx="6" fill="#0194A8" />
      <rect x="290" y="100" width="28" height="140" rx="6" fill="#027332" />
    </svg>
  );
}
