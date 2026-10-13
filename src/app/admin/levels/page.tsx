"use client";

import { AppFrame } from "@/components/app-frame";
import { OperationsGate } from "@/components/operations-gate";
import { LevelsPanel } from "@/features/research/levels-panel";

export default function AdminLevelsPage() {
  return (
    <AppFrame admin>
      <OperationsGate>
        <LevelsPanel />
      </OperationsGate>
    </AppFrame>
  );
}
