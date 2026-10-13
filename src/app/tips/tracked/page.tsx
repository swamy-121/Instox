"use client";

import { TipCollectionPage } from "@/features/tips/tip-collection";

export default function TrackedTipsPage() {
  return (
    <TipCollectionPage
      title="Tracked ideas"
      lede="Ideas you asked us to watch. When a target, stop, or window is reached, a note can show up in Tip alerts."
      path="/api/v1/tips/tracked"
      emptyTitle="Nothing tracked yet"
      emptyBody="Open an idea and tap Track. We will note the result when the daily check runs."
    />
  );
}
