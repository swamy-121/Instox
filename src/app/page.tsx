import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/chrome";

export default function LandingPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-sm font-medium text-primary">Market tips, written and reviewed by people</p>
        <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-navy">
          A plain record of trade ideas, with a trail for every change.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted">
          Instox is a mobile-first app for free and premium tips on Indian markets. Publishing is manual. Nothing here places an order or promises a result.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/sign-in" className="btn-primary">
            Sign in
          </Link>
          <Link href="/tips" className="btn-secondary">
            Browse tips
          </Link>
        </div>
        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["Free and premium", "Premium prices, stops, targets, and rationale stay on the server until your plan allows them."],
            ["Reviewed before publish", "Drafts move through review. Close, cancel, and expire each keep a reason."],
            ["No live feed yet", "A market-data vendor is not licensed. The app will not label sample figures as live."],
          ].map(([title, body]) => (
            <article key={title} className="card">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </article>
          ))}
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
