"use client";

import { AppFrame } from "@/components/app-frame";
import { useMemberConfig } from "@/features/app/member-config";
import { NotificationSettings } from "@/features/profile/notifications";

export default function SettingsPage() {
  return (
    <AppFrame requireAuth>
      <SettingsBody />
    </AppFrame>
  );
}

function SettingsBody() {
  const config = useMemberConfig();
  return (
    <div className="space-y-4">
      <h1 className="sr-only">Settings</h1>
      <p className="text-sm text-muted">{config.settingsIntro}</p>
      <NotificationSettings />
      <p className="text-xs text-muted">Version {config.appVersion}</p>
    </div>
  );
}
