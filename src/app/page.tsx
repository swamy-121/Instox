import Link from "next/link";
import { SplashGate } from "@/components/brand";
import { MaintenanceNotice } from "@/features/app/member-config";
import { PublicFooter, PublicHeader } from "@/components/chrome";
import { LockIcon, NewsIcon, TipsIcon } from "@/components/icons";
import { Wordmark } from "@/components/wordmark";
import { Chip } from "@/components/ui";

const TRUST = [
  ["Checked before it's posted", "Every idea is reviewed by our team before it goes live."],
  ["Clear levels", "Entry, stop-loss and targets on every call."],
  ["You stay in control", "We share ideas. You decide and trade on your own broker."],
  ["Live market view", "Nifty, Bank Nifty and your stocks at a glance."],
];

export default function LandingPage() {
  return (
    <SplashGate>
      <PublicHeader />
      <MaintenanceNotice />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-sm font-medium text-primary">Instant trading ideas</p>
            <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-ink md:text-5xl md:leading-tight">
              Trade ideas for the Indian market, clear and to the point.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted">
              Every idea comes with entry, stop-loss and targets, picked by our research team. Start free, upgrade when you want more.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/sign-in" className="btn-primary">
                Get started
              </Link>
              <Link href="/tips" className="btn-secondary">
                See today&apos;s ideas
              </Link>
            </div>
          </div>
          <Illustration />
        </section>
        <section className="border-y border-line bg-white">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 md:grid-cols-4">
            {TRUST.map(([title, body]) => (
              <article key={title}>
                <h2 className="text-sm font-semibold text-ink">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-4 py-12 md:grid-cols-3">
          {[
            [LockIcon, "Free and Premium ideas", "Free calls for everyone. More calls and detailed reasoning on Premium."],
            [NewsIcon, "Instant alerts", "Get notified the moment a new idea goes live."],
            [TipsIcon, "Honest track record", "Closed and stopped-out calls stay visible. Nothing is hidden."],
          ].map(([Icon, title, body]) => (
            <article key={String(title)} className="card">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-semibold text-ink">{String(title)}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{String(body)}</p>
            </article>
          ))}
        </section>
      </main>
      <PublicFooter />
    </SplashGate>
  );
}

function Illustration() {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <Wordmark decorative className="h-10 w-auto" />
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">NSE &middot; Equity &middot; 1-3 sessions</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <h2 className="text-3xl font-semibold tracking-tight tabular-nums text-ink">INFY</h2>
        <Chip tone="info">BUY</Chip>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          ["Entry", "1,800.00"],
          ["Stop", "1,750.00"],
          ["T1", "1,860.00"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-canvas px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-ink">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-muted">
        Sample idea for display only, not a live price or advice.
      </p>
    </div>
  );
}
