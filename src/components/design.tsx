import type { ReactNode } from "react";
import { formatPrice } from "@/lib/money";
import { absoluteMove } from "@/lib/market-session";

export function SampleBadge({ children = "Sample data" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-dashed border-[#E2C26A] bg-[#FFF4D6] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A6700]">
      <span aria-hidden="true">●</span>
      {children}
    </span>
  );
}

export function ChangeText({
  last,
  changePct,
  size = "sm",
}: {
  last?: number | null;
  changePct: number | null | undefined;
  size?: "xs" | "sm";
}) {
  if (changePct == null || !Number.isFinite(changePct)) {
    return <span className="text-xs text-muted">Change unavailable</span>;
  }
  const up = changePct >= 0;
  const move = last != null ? absoluteMove(last, changePct) : null;
  const points = move == null ? "" : `${formatPrice(Math.abs(move))} `;
  const text = `${up ? "Up" : "Down"} ${points}${Math.abs(changePct).toFixed(2)} percent`;
  return (
    <span className={`num font-semibold ${size === "xs" ? "text-[11.5px]" : "text-[13px]"} ${up ? "text-profit" : "text-loss"}`} aria-label={text}>
      <span aria-hidden="true">
        {up ? "▲" : "▼"} {points}({Math.abs(changePct).toFixed(2)}%)
      </span>
    </span>
  );
}

const PILL = {
  up: "bg-[#E6F4EC] text-profit",
  down: "bg-[#FCEBEB] text-loss",
  neutral: "bg-[#EEF2EF] text-muted",
  brand: "bg-primary-soft text-primary-dark",
  amber: "bg-[#FFF4D6] text-[#9A6700]",
} as const;

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof PILL;
}) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${PILL[tone]}`}>
      {children}
    </span>
  );
}

export function SidePill({ side }: { side: "BUY" | "SELL" | string }) {
  const sell = side === "SELL";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${sell ? PILL.down : PILL.up}`}>
      <span aria-hidden="true">{sell ? "▼" : "▲"}</span>
      {side}
    </span>
  );
}

export function StatusDot({ children, tone = "brand" }: { children: ReactNode; tone?: keyof typeof PILL }) {
  return (
    <Pill tone={tone}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </Pill>
  );
}

export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-5 flex items-baseline justify-between gap-3">
      <h2 className="text-base font-bold tracking-tight text-ink">{title}</h2>
      {action}
    </div>
  );
}

export function FilterChip({
  children,
  active = false,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        active ? "border-[#B5DCC4] bg-primary-soft font-semibold text-primary-dark" : "border-line bg-white text-ink hover:bg-canvas"
      }`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
