import { AppFrame } from "@/components/app-frame";
import { EmptyState } from "@/components/states";

export default function InsightsPage() {
  return (
    <AppFrame>
      <h1 className="text-2xl font-semibold">Insights</h1>
      <div className="mt-4">
        <EmptyState
          title="Insights are not in this release"
          body="Closed-tip performance needs an approved methodology and a licensed price source. Unclosed tips will not be counted as wins."
        />
      </div>
    </AppFrame>
  );
}
