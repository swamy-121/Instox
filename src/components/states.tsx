"use client";

import { Wordmark } from "@/components/wordmark";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="space-y-3" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Wordmark decorative className="h-7 w-auto" />
      <div className="h-24 animate-pulse rounded-card bg-white" />
      <div className="h-24 animate-pulse rounded-card bg-white" />
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-white p-6 text-center">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}

export function ErrorState({
  message,
  requestId,
  onRetry,
}: {
  message: string;
  requestId?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-card border border-line bg-white p-5">
      <h2 className="text-base font-semibold text-ink">Something went wrong</h2>
      <p className="mt-2 text-sm text-ink">{message}</p>
      {requestId ? <p className="mt-2 text-xs text-muted">Request {requestId}</p> : null}
      {onRetry ? (
        <button type="button" className="btn-secondary mt-4" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function PermissionDenied({ message = "You do not have access to this page." }: { message?: string }) {
  return (
    <div role="alert" className="rounded-card border border-line bg-white p-6">
      <h2 className="text-base font-semibold text-ink">Access denied</h2>
      <p className="mt-2 text-sm text-muted">{message}</p>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-4 sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-card bg-white p-5 shadow-card"
      >
        <h2 id="confirm-title" className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={busy} autoFocus>
            {busy ? "Working" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
