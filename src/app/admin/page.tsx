"use client";

import { AppFrame } from "@/components/app-frame";
import { DashboardView } from "@/features/admin/dashboard-view";

export default function AdminHomePage() {
  return (
    <AppFrame admin>
      <DashboardView title="Dashboard" lede="Users, premium accounts, recorded revenue, and ideas in the selected dates." />
    </AppFrame>
  );
}
