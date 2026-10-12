import { PublicFooter, PublicHeader } from "@/components/chrome";

export default function DisclaimerPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold text-navy">Risk disclosure</h1>
        <div className="mt-6 space-y-4 text-sm leading-6">
          <p>Market tips can be wrong. You can lose money, including more than you expect, if you trade.</p>
          <p>
            Instox does not place orders, hold funds, or guarantee returns. Historical or sample outcomes are not a promise of future results.
          </p>
          <p>
            A written legal review of the paid-tips model is still open. A disclaimer on this page does not mean the service is registered or cleared.
          </p>
          <p>Figures marked sample data are not quotes from an exchange and must not be treated as prices.</p>
          <p>Version: 2026-10-11-draft.</p>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
