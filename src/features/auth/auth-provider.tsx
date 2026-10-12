"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
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
  | { status: "signed_out" }
  | { status: "error"; message: string }
  | { status: "ready"; me: Me; emailConflict: boolean };

type AuthContextValue = {
  state: AuthState;
  refresh: (flags?: { emailConflict?: boolean }) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadMe(): Promise<{ me: Me } | { error: string; status: number }> {
  const result = await apiFetch<Me>("/api/v1/me");
  if (!result.ok) return { error: result.message, status: result.status };
  return { me: result.data };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refresh = useCallback(async (flags?: { emailConflict?: boolean }) => {
    const loaded = await loadMe();
    if ("error" in loaded) {
      if (loaded.status === 401) setState({ status: "signed_out" });
      else setState({ status: "error", message: loaded.error });
      return;
    }
    setState({ status: "ready", me: loaded.me, emailConflict: flags?.emailConflict === true });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      refresh,
      signOutUser: async () => {
        await apiFetch("/api/v1/session", { method: "DELETE" });
        setState({ status: "signed_out" });
      },
    }),
    [state, refresh],
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
