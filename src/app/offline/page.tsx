import { Wordmark } from "@/components/wordmark";

export default function OfflinePage() {
  return (
    <main className="brand-surface mx-auto min-h-screen max-w-lg px-4 py-16">
      <Wordmark className="h-auto w-72" />
      <h1 className="mt-8 text-2xl font-semibold text-ink">You are offline</h1>
      <p className="mt-3 text-sm text-muted">
        Sign-in, tips, and payments need a connection. Private content is not kept in the offline cache.
      </p>
    </main>
  );
}
