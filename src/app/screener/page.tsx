import { AppFrame } from "@/components/app-frame";
import { EmptyState } from "@/components/states";

export default function ScreenerPage() {
  return (
    <AppFrame>
      <h1 className="text-2xl font-semibold">Screener</h1>
      <div className="mt-4">
        <EmptyState
          title="Screener is not in this release"
          body="Indicator screens need a licensed instrument master and candle source. No sample scan is shown, so nothing here can be mistaken for a live result."
        />
      </div>
    </AppFrame>
  );
}
