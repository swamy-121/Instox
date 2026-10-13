import { Wordmark } from "@/components/wordmark";

export default function OfflinePage() {
  return (
    <main className="brand-surface mx-auto min-h-screen max-w-lg px-4 py-16">
      <Wordmark className="h-auto w-72" />
      <h1 className="mt-8 text-2xl font-semibold text-ink">You&apos;re offline</h1>
      <p className="mt-3 text-sm text-muted">
        Connect to the internet to sign in, see ideas or make a payment. Your private details aren&apos;t saved on this device.
      </p>
    </main>
  );
}
