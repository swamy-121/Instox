export function StockAvatar({ symbol, className = "h-9 w-9 text-xs" }: { symbol: string; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md border border-line bg-canvas font-semibold text-ink ${className}`}
      aria-hidden="true"
    >
      {symbol.slice(0, 2)}
    </span>
  );
}

export function OnboardingArt({ icon }: { icon: string }) {
  if (icon === "search") return <MagnifierChart />;
  if (icon === "news") return <NewsBell />;
  return <PhoneChart />;
}

function PhoneChart() {
  return (
    <svg viewBox="0 0 220 180" className="h-52 w-full max-w-xs" aria-hidden="true">
      <rect x="58" y="8" width="104" height="164" rx="18" fill="#fff" stroke="#D3E3DB" strokeWidth="3" />
      <rect x="92" y="16" width="36" height="6" rx="3" fill="#D3E3DB" />
      <rect x="72" y="36" width="76" height="110" rx="8" fill="#E5F6EC" />
      <rect x="84" y="96" width="10" height="32" rx="2" fill="#027332" />
      <rect x="100" y="78" width="10" height="50" rx="2" fill="#0F7A45" />
      <rect x="116" y="62" width="10" height="66" rx="2" fill="#0194A8" />
      <rect x="132" y="48" width="10" height="80" rx="2" fill="#027332" />
      <circle cx="168" cy="46" r="16" fill="#027332" />
      <path d="M160 46l5 5 10-11" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MagnifierChart() {
  return (
    <svg viewBox="0 0 220 180" className="h-52 w-full max-w-xs" aria-hidden="true">
      <rect x="28" y="28" width="120" height="110" rx="16" fill="#E5F6EC" />
      <path d="M46 112l24-28 18 16 28-40" fill="none" stroke="#027332" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="148" cy="108" r="34" fill="#fff" stroke="#027332" strokeWidth="8" />
      <path d="M172 132l24 24" stroke="#025A28" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

function NewsBell() {
  return (
    <svg viewBox="0 0 220 180" className="h-52 w-full max-w-xs" aria-hidden="true">
      <rect x="36" y="28" width="110" height="124" rx="16" fill="#fff" stroke="#D3E3DB" strokeWidth="3" />
      <rect x="52" y="48" width="78" height="10" rx="4" fill="#027332" />
      <rect x="52" y="68" width="62" height="8" rx="4" fill="#D3E3DB" />
      <rect x="52" y="84" width="70" height="8" rx="4" fill="#D3E3DB" />
      <rect x="52" y="108" width="48" height="24" rx="6" fill="#E5F6EC" />
      <path d="M156 58c0-16 12-28 28-28 10 0 18 6 22 14" fill="none" stroke="#0194A8" strokeWidth="4" strokeLinecap="round" />
      <path d="M150 92c8-6 14-16 14-28 12 4 22 16 22 30v10l8 8H142l8-8v-12Z" fill="#027332" />
      <circle cx="172" cy="120" r="6" fill="#025A28" />
    </svg>
  );
}

export function NewsThumb({ category }: { category: string }) {
  const key = category.toLowerCase();
  return (
    <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft">
      {key.includes("econom") || key.includes("policy") ? <ThumbBars /> : null}
      {key.includes("result") ? <ThumbResults /> : null}
      {key.includes("global") || key.includes("fed") ? <ThumbGlobe /> : null}
      {key.includes("commod") || key.includes("oil") ? <ThumbDrop /> : null}
      {!/econom|policy|result|global|fed|commod|oil/.test(key) ? <ThumbBars /> : null}
    </span>
  );
}

function ThumbBars() {
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
      <rect x="12" y="36" width="8" height="16" rx="2" fill="#027332" />
      <rect x="24" y="26" width="8" height="26" rx="2" fill="#0194A8" />
      <rect x="36" y="18" width="8" height="34" rx="2" fill="#027332" />
      <rect x="48" y="12" width="6" height="40" rx="2" fill="#0F7A45" />
    </svg>
  );
}

function ThumbResults() {
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
      <rect x="14" y="12" width="36" height="40" rx="6" fill="#fff" stroke="#027332" strokeWidth="2" />
      <path d="M22 36l6 6 12-14" fill="none" stroke="#027332" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ThumbGlobe() {
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
      <circle cx="32" cy="32" r="16" fill="none" stroke="#0194A8" strokeWidth="2.5" />
      <ellipse cx="32" cy="32" rx="8" ry="16" fill="none" stroke="#027332" strokeWidth="2" />
      <path d="M16 32h32M20 24h24M20 40h24" stroke="#027332" strokeWidth="2" />
    </svg>
  );
}

function ThumbDrop() {
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
      <path d="M32 12c8 12 16 18 16 28a16 16 0 1 1-32 0c0-10 8-16 16-28Z" fill="#027332" />
    </svg>
  );
}

export function AreaChart({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const width = 320;
  const height = 150;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = 16 + (1 - (value - min) / span) * (height - 36);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="Price chart">
      <path d={area} fill="#027332" opacity="0.08" />
      <path d={line} fill="none" stroke="#027332" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
