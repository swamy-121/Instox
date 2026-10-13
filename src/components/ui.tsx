import type { ReactNode } from "react";

export function PageHeader({ title, lede, action, embedded = false }: { title: string; lede?: string; action?: ReactNode; embedded?: boolean }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className={embedded ? "sr-only" : "text-lg font-bold tracking-tight text-ink"}>{title}</h1>
        {lede ? <p className={`${embedded ? "" : "mt-1"} max-w-xl text-sm leading-6 text-muted`}>{lede}</p> : null}
      </div>
      {action}
    </div>
  );
}

const CHIP = {
  neutral: "bg-canvas text-ink",
  info: "bg-primary-soft text-primary",
  profit: "bg-[#E7F6EE] text-profit",
  loss: "bg-[#FDECEC] text-loss",
} as const;

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof CHIP }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[tone]}`}>{children}</span>;
}

export function Sparkline({ seed, positive }: { seed: string; positive: boolean }) {
  let state = 0;
  for (const char of seed) state = (state * 33 + char.charCodeAt(0)) % 997;
  const values: number[] = [];
  let cursor = 12;
  for (let index = 0; index < 16; index += 1) {
    state = (state * 17 + 13) % 997;
    cursor += ((state % 7) - 3) * 0.35;
    values.push(cursor);
  }
  values[values.length - 1] = positive ? Math.max(...values) + 0.4 : Math.min(...values) - 0.4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 72;
      const y = 22 - ((value - min) / span) * 18;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 72 24" className="h-6 w-[4.5rem]" aria-hidden="true">
      <polyline fill="none" stroke={positive ? "#0F7A45" : "#B42318"} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" points={points} />
    </svg>
  );
}
