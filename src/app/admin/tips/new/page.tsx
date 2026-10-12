"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTitle } from "@/components/admin-ui";
import { PermissionDenied } from "@/components/states";
import { useAuth } from "@/features/auth/auth-provider";
import { emptyTipForm, TipForm, toTipPayload, type ListingIntent, type TipFormValue } from "@/features/tips/tip-form";
import { apiFetch } from "@/lib/api-client";
import { canEditTips, canPublishTips } from "@/server/authorization/roles";
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

  const publisher = state.status === "ready" && canPublishTips(state.me.roles);

  async function submit(form: TipFormValue, listing: ListingIntent) {
    setBusy(true);
    setError(null);
    const result = await apiFetch<{ tip: TipRecord }>("/api/v1/admin/tips", {
      method: "POST",
      body: JSON.stringify(toTipPayload(form)),
    });
    if (!result.ok) {
      setBusy(false);
      setError(result.message);
      setFields(result.fields ?? {});
      return;
    }
    const tip = result.data.tip;
    if (listing === "draft") {
      setBusy(false);
      router.push("/admin/tips");
      return;
    }
    const reviewed = await apiFetch<{ tip: TipRecord }>(`/api/v1/admin/tips/${tip.id}/transition`, {
      method: "POST",
      body: JSON.stringify({ action: "submit_review", expectedVersion: tip.version, reason: "Submitted from the tip form" }),
    });
    if (!reviewed.ok || !publisher) {
      setBusy(false);
      router.push(`/admin/tips/${tip.id}`);
      return;
    }
    const published = await apiFetch(`/api/v1/admin/tips/${tip.id}/publish`, {
      method: "POST",
      headers: { "idempotency-key": `publish.${tip.id}.v${reviewed.data.tip.version}` },
      body: JSON.stringify({
        expectedVersion: reviewed.data.tip.version,
        reason: "Published from the tip form",
        reviewChecklist: ["fields_validated", "risk_disclosure_present", "category_rules_checked"],
      }),
    });
    setBusy(false);
    router.push(published.ok ? "/admin/tips" : `/admin/tips/${tip.id}`);
  }

  return (
    <div>
      <AdminTitle title="New idea" lede="Saves a draft. Publishers can also publish from this form." />
      {error ? <p className="mb-3 text-sm text-ink" role="alert">{error}</p> : null}
      <TipForm
        initial={emptyTipForm()}
        fields={fields}
        busy={busy}
        showListing
        submitLabel="Publish Tip"
        onCancel={() => router.push("/admin/tips")}
        onSubmit={(form, listing) => void submit(form, listing)}
      />
    </div>
  );
}
