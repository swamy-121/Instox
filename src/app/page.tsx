import Link from "next/link";
import { Download, Lightbulb, LineChart, Activity } from "lucide-react";
import { SplashGate } from "@/components/brand";
import { MaintenanceNotice } from "@/features/app/member-config";
import { PublicFooter } from "@/components/chrome";
import { Wordmark } from "@/components/wordmark";
import { PhoneStart } from "@/features/auth/phone-start";

const FEATURES = [
  [Lightbulb, "Trading ideas, clearly laid out", "Entry, stop-loss, targets and status on every tip."],
  [LineChart, "Screeners that explain themselves", "See exactly which filters each stock matched."],
  [Activity, "Market Pulse and insights", "Indicators with their period, coverage and timestamp."],
] as const;

export default function LandingPage() {
  return (
    <SplashGate>
      <MaintenanceNotice />
      <main className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_520px]">
        <section className="relative bg-[radial-gradient(1200px_600px_at_-10%_-10%,#E3F2E9,transparent_60%)] px-5 py-6 lg:px-16 lg:py-9">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" aria-label="Instox">
              <Wordmark decorative className="h-9 w-auto" />
            </Link>
            <nav className="hidden items-center gap-4 text-sm font-semibold text-muted lg:flex">
              <a href="#features">Features</a>
              <Link href="/premium">Premium</Link>
              <Link href="/help">Help</Link>
            </nav>
          </div>
          <div className="mt-8 max-w-[620px] lg:mt-20">
            <span className="inline-flex rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary-dark">
              Market insights · Tips · Screeners
            </span>
            <h1 className="mt-4 text-[30px] font-extrabold leading-[1.15] tracking-tight text-ink lg:text-[52px] lg:leading-[1.08]">
              Make sense of the market, <span className="text-primary">one clear idea at a time.</span>
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-6 text-muted lg:mt-4 lg:text-[17px]">
              Track indices, follow structured trading ideas with entry, stop-loss and targets, and screen stocks with filters you can actually read.
            </p>
            <div className="mt-6 hidden gap-3 lg:flex">
              <Link href="/sign-in" className="btn-primary h-[50px] px-6">Get started</Link>
              <Link href="/help" className="btn-secondary h-[50px] px-6">
                <Download className="h-4 w-4" aria-hidden="true" />
                Install app
              </Link>
            </div>
          </div>
          <div className="mt-6 lg:hidden">
            <SignCard />
          </div>
          <ul id="features" className="mt-6 grid gap-3 lg:mt-10">
            {FEATURES.map(([Icon, title, body]) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-ink">{title}</span>
                  <span className="block text-[11px] text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-xl text-[11px] leading-5 text-muted">
            Market investments are subject to risk. Instox provides information and research tools; it does not guarantee any outcome.
          </p>
          <p className="mt-4 text-sm lg:hidden">
            <Link href="/onboarding" className="font-semibold text-primary">See how Instox works</Link>
          </p>
        </section>
        <section className="hidden border-l border-line bg-white px-16 py-10 lg:flex lg:flex-col lg:justify-center">
          <h2 className="text-[26px] font-bold tracking-tight text-ink">Welcome to Instox</h2>
          <p className="mt-1 text-muted">Sign in or create an account with your mobile number.</p>
          <div className="mt-6">
            <SignCard bare />
          </div>
          <ul className="mt-8 grid gap-3.5">
            {FEATURES.map(([Icon, title, body]) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-ink">{title}</span>
                  <span className="block text-[11px] text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <div className="lg:hidden">
        <PublicFooter />
      </div>
    </SplashGate>
  );
}

function SignCard({ bare = false }: { bare?: boolean }) {
  return (
    <div className={bare ? "" : "card"}>
      {bare ? null : (
        <>
          <h2 className="text-base font-bold text-ink">Sign in or create account</h2>
          <p className="mt-0.5 text-[11px] text-muted">We&apos;ll send a one-time code to your phone</p>
          <div className="mt-3" />
        </>
      )}
      <PhoneStart idPrefix={bare ? "desk" : "mob"} />
    </div>
  );
}
