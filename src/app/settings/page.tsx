"use client";

import { AppFrame } from "@/components/app-frame";
import { NotificationSettings } from "@/features/profile/notifications";

export default function SettingsPage() {
  return (
    <AppFrame requireAuth>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="text-sm text-muted">Notification choices are saved on your account.</p>
        <NotificationSettings />
      </div>
    </AppFrame>
  );
}
