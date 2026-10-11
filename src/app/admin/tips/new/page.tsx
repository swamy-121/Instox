"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { PermissionDenied } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { emptyTipForm, TipForm, toTipPayload, type TipFormValue } from "@/features/tips/tip-form";
import { apiFetch } from "@/lib/api-client";
import { canEditTips } from "@/server/authorization/roles";
import type { TipRecord } from "@/types/domain";

export default function NewTipPage() {
  return (
    <AppFrame admin>
      <NewTip />
    </AppFrame>
  );
}

function NewTip() {
  const { state } = useAuth();
  const router = useRouter();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === "ready" && !canEditTips(state.me.roles)) {
    return <PermissionDenied message="You cannot create drafts." />;
  }

  async function submit(form: TipFormValue) {
    setBusy(true);
    setError(null);
    const result = await apiFetch<{ tip: TipRecord }>("/api/v1/admin/tips", {
      method: "POST",
      body: JSON.stringify(toTipPayload(form)),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setFields(result.fields ?? {});
      return;
    }
    router.push(`/admin/tips/${result.data.tip.id}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">New draft</h1>
      {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
      <div className="mt-4">
        <TipForm initial={emptyTipForm()} fields={fields} busy={busy} submitLabel="Save draft" onSubmit={(form) => void submit(form)} />
      </div>
    </div>
  );
}
