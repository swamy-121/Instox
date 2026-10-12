"use client";

import { useAuth } from "@/features/auth/auth-provider";
import { PermissionDenied } from "@/components/states";
import { canManageIntegrations } from "@/server/authorization/roles";

export function SuperAdminGate({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  if (state.status !== "ready") return null;
  if (!canManageIntegrations(state.me.roles)) {
    return <PermissionDenied message="Only a super admin can open integration keys." />;
  }
  return <>{children}</>;
}
