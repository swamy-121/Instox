"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { MEMBER_COPY_DEFAULTS, type MemberCopy } from "@/lib/member-copy";

const MemberConfigContext = createContext<MemberCopy>(MEMBER_COPY_DEFAULTS);

export function MemberConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<MemberCopy>(MEMBER_COPY_DEFAULTS);

  useEffect(() => {
    apiFetch<{ config: MemberCopy }>("/api/v1/app-config").then((result) => {
      if (result.ok) setConfig({ ...MEMBER_COPY_DEFAULTS, ...result.data.config });
    });
  }, []);

  return <MemberConfigContext.Provider value={config}>{children}</MemberConfigContext.Provider>;
}

export function useMemberConfig(): MemberCopy {
  return useContext(MemberConfigContext);
}

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<MemberCopy | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    apiFetch<{ config: MemberCopy }>("/api/v1/app-config").then((result) => {
      if (result.ok) setConfig({ ...MEMBER_COPY_DEFAULTS, ...result.data.config });
      setReady(true);
    });
  }, []);

  if (ready && config?.maintenance) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="card">
          <h1 className="text-lg font-semibold text-ink">{config.maintenanceTitle}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{config.maintenanceBody}</p>
        </div>
      </main>
    );
  }
  return <>{children}</>;
}

export function MaintenanceNotice() {
  const [config, setConfig] = useState<MemberCopy | null>(null);

  useEffect(() => {
    apiFetch<{ config: MemberCopy }>("/api/v1/app-config").then((result) => {
      if (result.ok) setConfig({ ...MEMBER_COPY_DEFAULTS, ...result.data.config });
    });
  }, []);

  if (!config?.maintenance) return null;
  return (
    <p className="bg-loss px-4 py-3 text-sm text-white">
      {config.maintenanceTitle}. {config.maintenanceBody}
    </p>
  );
}
