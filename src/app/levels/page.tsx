"use client";

import { AppFrame } from "@/components/app-frame";
import { LevelsPanel } from "@/features/research/levels-panel";

export default function LevelsPage() {
  return (
    <AppFrame requireAuth>
      <LevelsPanel />
    </AppFrame>
  );
}
