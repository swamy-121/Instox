import { PublicFooter, PublicHeader } from "@/components/chrome";

export default function AboutPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold text-navy">About</h1>
        <div className="mt-6 space-y-4 text-sm leading-6 text-ink">
          <p>
            Instox publishes market tips that a person drafts and another person can review. The first release keeps that workflow manual.
          </p>
          <p>
            Support and grievance ownership is not assigned yet. Until that decision is recorded, there is no production contact channel on this page.
          </p>
          <p>Company details, FAQs, and a grievance officer will be added after the product owner names them.</p>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
