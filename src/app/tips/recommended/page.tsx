"use client";

import { TipCollectionPage } from "@/features/tips/tip-collection";

export default function RecommendedTipsPage() {
  return (
    <TipCollectionPage
      title="Ideas for you"
      lede="Featured ideas come first, then symbols you have already saved. This is a reading list, not a promise of returns."
      path="/api/v1/tips/recommended"
      emptyTitle="Nothing to suggest yet"
      emptyBody="When new ideas are published, a short list will show up here."
    />
  );
}
