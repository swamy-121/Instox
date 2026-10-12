export function FreshnessMark({ status }: { status?: string }) {
  if (status !== "stale" && status !== "offline" && status !== "delayed") return null;
  const label = status === "stale" ? "Stale" : status === "offline" ? "Offline" : "Delayed";
  return <span className="text-xs font-medium text-muted">{label}</span>;
}
