"use client";

import Link from "next/link";
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
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Settings</h1>
        <Link href="/notifications" className="text-sm font-medium text-primary">Alert history</Link>
      </div>
      <p className="text-sm text-muted">{config.settingsIntro}</p>
      <NotificationSettings />
      <p className="text-xs text-muted">Version {config.appVersion}</p>
    </div>
  );
}
