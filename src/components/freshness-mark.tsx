export function FreshnessMark({ status }: { status?: string }) {
  if (status !== "stale" && status !== "offline" && status !== "delayed") return null;
  const label = status === "stale" ? "Stale" : status === "offline" ? "Offline" : "Delayed";
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#9A6700]">
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}
