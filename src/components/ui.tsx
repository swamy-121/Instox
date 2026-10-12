import type { ReactNode } from "react";

export function PageHeader({ title, lede, action }: { title: string; lede?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {lede ? <p className="mt-1 max-w-xl text-sm leading-6 text-muted">{lede}</p> : null}
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

