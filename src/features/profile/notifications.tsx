"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { getFirebaseApp } from "@/lib/firebase-client";

type Preferences = { tipPush: boolean; marketingPush: boolean };
type DeviceRow = { id: string; revoked: boolean; createdAt: string };
type Snapshot = {
  preferences: Preferences;
  devices: DeviceRow[];
  fcmConfigured: boolean;
  clientConfigured: boolean;
};

export function NotificationSettings() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [tipPush, setTipPush] = useState(false);
  const [marketingPush, setMarketingPush] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    apiFetch<Snapshot>("/api/v1/notifications").then((result) => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSnapshot(result.data);
      setTipPush(result.data.preferences.tipPush);
      setMarketingPush(result.data.preferences.marketingPush);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await apiFetch("/api/v1/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify({ tipPush, marketingPush }),
    });
    setBusy(false);
    setMessage(result.ok ? "Notification choices saved." : result.message);
    if (result.ok) load();
  }

  async function registerDevice() {
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";
    const senderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "";
    if (!vapidKey || !senderId) {
      setMessage("Notifications are not available on this device yet.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      setMessage("This browser does not support Firebase Cloud Messaging.");
      return;
    }
    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) {
      setMessage("This browser does not support Firebase Cloud Messaging.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setMessage("Notification permission was not granted.");
      return;
    }
    const app = getFirebaseApp();
    if (!app) {
      setMessage("Firebase is not configured in this browser.");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/firebase-cloud-messaging-push-scope",
      });
      const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
      if (!token) {
        setMessage("Firebase did not return a device token.");
        return;
      }
      const result = await apiFetch("/api/v1/fcm-tokens", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      setMessage(result.ok ? "This browser is registered for FCM alerts." : result.message);
      if (result.ok) load();
    } catch {
      setMessage("Could not register this browser with Firebase Cloud Messaging.");
    }
  }

  async function revoke(id: string) {
    const result = await apiFetch(`/api/v1/fcm-tokens/${id}`, { method: "DELETE" });
    setMessage(result.ok ? "This device token was revoked." : result.message);
    if (result.ok) load();
  }

  return (
    <section className="card space-y-4">
      <h2 className="text-base font-semibold text-ink">Notifications</h2>
      <p className="text-sm leading-6 text-muted">
        Tip alerts and marketing alerts are separate. Nothing is sent without a saved choice.
      </p>
      <form className="space-y-3" onSubmit={(event) => void save(event)}>
        <label className="flex items-center gap-3 text-sm text-ink">
          <input className="h-4 w-4 accent-ink" type="checkbox" checked={tipPush} onChange={(event) => setTipPush(event.target.checked)} />
          Tip alerts
        </label>
        <label className="flex items-center gap-3 text-sm text-ink">
          <input className="h-4 w-4 accent-ink" type="checkbox" checked={marketingPush} onChange={(event) => setMarketingPush(event.target.checked)} />
          Marketing alerts
        </label>
        <button className="btn-secondary" type="submit" disabled={busy}>Save choices</button>
      </form>
      <button type="button" className="btn-secondary" onClick={() => void registerDevice()}>
        Register this browser
      </button>
      <ul className="space-y-2 text-sm">
        {snapshot?.devices.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3">
            <span>{item.revoked ? "Revoked" : "Active"} · {item.createdAt.slice(0, 10)}</span>
            {item.revoked ? null : (
              <button type="button" className="btn-secondary" onClick={() => void revoke(item.id)}>Revoke</button>
            )}
          </li>
        ))}
      </ul>
      {message ? <p className="text-sm" role="status">{message}</p> : null}
    </section>
  );
}
