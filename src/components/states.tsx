"use client";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="space-y-3" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="card animate-pulse space-y-3">
        <div className="h-3 w-24 rounded-full bg-canvas" />
        <div className="h-5 w-40 rounded-full bg-canvas" />
        <div className="h-3 w-full rounded-full bg-canvas" />
      </div>
      <div className="card animate-pulse space-y-3">
        <div className="h-3 w-20 rounded-full bg-canvas" />
        <div className="h-5 w-32 rounded-full bg-canvas" />
        <div className="h-3 w-2/3 rounded-full bg-canvas" />
      </div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-4">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted">{body}</p>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-lg border border-line bg-white p-5"
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
