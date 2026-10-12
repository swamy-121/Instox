import Link from "next/link";
import { SplashGate } from "@/components/brand";
import { PublicFooter, PublicHeader } from "@/components/chrome";
import { PenIcon, ShieldIcon } from "@/components/icons";
import { Wordmark } from "@/components/wordmark";
import { Chip } from "@/components/ui";

const TRUST = [
  ["Reviewed by people", "A draft is checked before it is published. Close, cancel, and expire each keep a reason."],
  ["Levels stay on the server", "Premium entry, stop, targets, and the write-up are omitted until a plan is active."],
  ["No orders from this app", "Instox records ideas. It does not place trades and it does not promise a result."],
  ["Sample figures are labeled", "A market-data vendor is not licensed, so quotes in the app say Sample data."],
];

export default function LandingPage() {
  return (
    <SplashGate>
      <PublicHeader />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-sm font-medium text-primary">Instant trading ideas</p>
            <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-ink md:text-5xl md:leading-tight">
              Indian market ideas, written down with the levels.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted">
              Free ideas show the entry, stop, and targets. Premium ideas stay locked until your plan is active. Publishing is manual.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/sign-in" className="btn-primary">
                Sign in
              </Link>
              <Link href="/tips" className="btn-secondary">
                Browse ideas
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
            [PenIcon, "A desk, not a feed", "Editors draft an idea. A publisher reviews it. The event log keeps the old and new state."],
            [ShieldIcon, "Access is checked on the server", "Roles and premium come from the account record, not from a flag the browser can set."],
            [ShieldIcon, "Risk stays on the page", "Every published idea points at the current risk disclosure. Past events are not rewritten."],
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
        <Wordmark decorative className="h-7 w-auto" />
        <Chip>Illustration</Chip>
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">NSE · Equity · 1-3 sessions</p>
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
        A picture of a published free idea. It is not a live quote and it is not a recommendation to trade.
      </p>
    </div>
  );
}
