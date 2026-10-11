"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, setTokenProvider } from "@/lib/api-client";
import { getClientAuth } from "@/lib/firebase-client";
import type { ResolvedEntitlement, Role, UserStatus } from "@/types/domain";

export type Me = {
  uid: string;
  displayName: string;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  status: UserStatus;
  locale: string;
  timezone: string;
  consentVersion: string | null;
  profileComplete: boolean;
  providers: string[];
  roles: Role[];
  entitlement: ResolvedEntitlement;
};

type AuthState =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "signed_out" }
  | { status: "error"; message: string }
  | { status: "ready"; me: Me; emailConflict: boolean };

type AuthContextValue = {
  state: AuthState;
  refresh: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadMe(): Promise<{ me: Me } | { error: string }> {
  const result = await apiFetch<Me>("/api/v1/me");
  if (!result.ok) return { error: result.message };
  return { me: result.data };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [emailConflict, setEmailConflict] = useState(false);

  useEffect(() => {
    const auth = getClientAuth();
    if (!auth) {
      setState({ status: "unconfigured" });
      return;
    }

    setTokenProvider(async () => {
      const current = auth.currentUser;
      if (!current) return null;
      return current.getIdToken();
    });

    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        setState({ status: "signed_out" });
        return;
      }
      setState({ status: "loading" });
      const token = await user.getIdToken();
      const session = await apiFetch<{ emailConflict: boolean }>("/api/v1/session", {
        method: "POST",
        body: JSON.stringify({ idToken: token }),
      });
      if (!session.ok) {
        setState({ status: "error", message: session.message });
        return;
      }
      setEmailConflict(Boolean(session.data.emailConflict));
      const loaded = await loadMe();
      if ("error" in loaded) {
        setState({ status: "error", message: loaded.error });
        return;
      }
      setState({ status: "ready", me: loaded.me, emailConflict: Boolean(session.data.emailConflict) });
    });

    return () => unsub();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      refresh: async () => {
        const auth = getClientAuth();
        const user = auth?.currentUser;
        if (!user) {
          setState({ status: "signed_out" });
          return;
        }
        const loaded = await loadMe();
        if ("error" in loaded) {
          setState({ status: "error", message: loaded.error });
          return;
        }
        setState({ status: "ready", me: loaded.me, emailConflict });
      },
      signOutUser: async () => {
        await apiFetch("/api/v1/session", { method: "DELETE" });
        const auth = getClientAuth();
        if (auth) await signOut(auth);
        setState({ status: "signed_out" });
      },
    }),
    [state, emailConflict],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function useSignedInRedirect(path = "/home"): void {
  const { state } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (state.status !== "ready") return;
    if (state.me.status !== "active") {
      router.replace("/home");
      return;
    }
    if (!state.me.profileComplete) {
      router.replace("/profile/complete");
      return;
    }
    router.replace(path);
  }, [state, router, path]);
}
