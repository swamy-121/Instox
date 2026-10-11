"use client";

import { useAuth } from "@/features/auth/auth-provider";
import { PermissionDenied } from "@/components/states";
import { canManageOperations } from "@/server/authorization/roles";

export function OperationsGate({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  if (state.status !== "ready") return null;
  if (!canManageOperations(state.me.roles)) {
    return <PermissionDenied message="This screen needs an admin role." />;
  }
  return <>{children}</>;
}
