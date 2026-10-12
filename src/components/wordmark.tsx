export function Wordmark({ className = "h-12 w-auto", decorative = false }: { className?: string; decorative?: boolean }) {
  return (
    // The official file scales by CSS height. next/image locks the intrinsic size.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/wordmark.png"
      width={1569}
      height={489}
      alt={decorative ? "" : "inStox, Instant Trading Ideas"}
      aria-hidden={decorative || undefined}
      className={className}
    />
  );
}
