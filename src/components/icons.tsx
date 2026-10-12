import type { ReactNode } from "react";

type IconProps = { className?: string };

function Icon({ className = "h-5 w-5", children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </Icon>
  );
}

export function TipsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 6h11M8 12h11M8 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </Icon>
  );
}

export function ScreenerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 19V10M10 19V5M16 19v-7M22 19H2" />
    </Icon>
  );
}

export function InsightsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 16l5-5 3 3 8-8" />
      <path d="M15 6h5v5" />
    </Icon>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 19c1.5-3 3.8-4.5 7-4.5S17.5 16 19 19" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 5 6v6c0 4.2 2.8 7.2 7 8.5 4.2-1.3 7-4.3 7-8.5V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

export function PenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4l10-10-4-4L4 16v4Z" />
      <path d="m13 7 4 4" />
    </Icon>
  );
}
