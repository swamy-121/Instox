import { PublicFooter, PublicHeader } from "@/components/chrome";

export default function AboutPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold text-navy">About</h1>
        <div className="mt-6 space-y-4 text-sm leading-6 text-ink">
          <p>
            Instox shares trade ideas for the Indian market. Every idea is written by a person on our team and checked before it goes live.
          </p>
          <p>
            We're still setting up our support and grievance desk, so there's no contact option here just yet.
          </p>
          <p>Company details, FAQs and our grievance officer's contact will be added here soon.</p>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
