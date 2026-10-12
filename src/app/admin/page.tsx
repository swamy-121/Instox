"use client";

import { AppFrame } from "@/components/app-frame";
import { DashboardView } from "@/features/admin/dashboard-view";

export default function AdminHomePage() {
  return (
    <AppFrame admin>
      <DashboardView title="Dashboard" lede="Welcome back. Here is what is happening with Instox." />
    </AppFrame>
  );
}
