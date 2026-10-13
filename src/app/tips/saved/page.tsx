"use client";

import { TipCollectionPage } from "@/features/tips/tip-collection";

export default function SavedTipsPage() {
  return (
    <TipCollectionPage
      title="Saved ideas"
      lede="Ideas you kept to read again. Saving one does not place a trade."
      path="/api/v1/tips/saved"
      emptyTitle="Nothing saved yet"
      emptyBody="Open an idea and tap Save. It will stay here."
    />
  );
}
