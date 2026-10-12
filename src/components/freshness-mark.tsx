export function FreshnessMark({ status }: { status?: string }) {
  if (status !== "stale" && status !== "offline") return null;
  return <span className="text-xs font-medium text-muted">{status === "stale" ? "Stale" : "Offline"}</span>;
}
