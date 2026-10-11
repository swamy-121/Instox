"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

type Preferences = { tipPush: boolean; marketingPush: boolean };
type SubscriptionRow = { id: string; revoked: boolean; createdAt: string };
type Snapshot = { preferences: Preferences; subscriptions: SubscriptionRow[]; vapidConfigured: boolean; publicKey: string };

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

  async function subscribe() {
    const publicKey = snapshot?.publicKey ?? "";
    if (!publicKey) {
      setMessage("Web Push is not configured. Your consent is saved, but no alert will be sent.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setMessage("This browser does not support Web Push.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setMessage("Notification permission was not granted.");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
    const json = subscription.toJSON();
    const result = await apiFetch("/api/v1/push-subscriptions", {
      method: "POST",
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    setMessage(result.ok ? "This browser is registered for alerts." : result.message);
    if (result.ok) load();
  }

  async function revoke(id: string) {
    const result = await apiFetch(`/api/v1/push-subscriptions/${id}`, { method: "DELETE" });
    setMessage(result.ok ? "Push subscription revoked." : result.message);
    if (result.ok) load();
  }

  return (
    <section className="card space-y-4">
      <h2 className="text-base font-semibold text-ink">Notifications</h2>
      <p className="text-sm leading-6 text-muted">
        Tip alerts and marketing alerts are separate. Nothing is sent without a saved choice, and alert text does not include entry, stop, or targets.
        {snapshot && !snapshot.vapidConfigured ? " VAPID keys are empty, so delivery stays off." : ""}
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
      <button type="button" className="btn-secondary" onClick={() => void subscribe()}>
        {snapshot?.publicKey ? "Register this browser" : "Push delivery is unconfigured"}
      </button>
      <ul className="space-y-2 text-sm">
        {snapshot?.subscriptions.map((item) => (
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

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}
