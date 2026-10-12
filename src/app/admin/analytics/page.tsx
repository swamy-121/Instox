"use client";

import { AppFrame } from "@/components/app-frame";
import { DashboardView } from "@/features/admin/dashboard-view";

export default function AnalyticsPage() {
  return (
    <AppFrame admin>
      <DashboardView title="Analytics" lede="The same stored totals, grouped by the date range you pick." />
    </AppFrame>
  );
}
