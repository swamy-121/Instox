export type MessagingSwConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId: string;
};

function usableConfig(config: MessagingSwConfig | null): MessagingSwConfig | null {
  if (!config) return null;
  const values = Object.values(config);
  if (values.some((value) => !value || /[<>\r\n\\]/.test(value))) return null;
  return config;
}

/** Service worker source for /firebase-messaging-sw.js. It does not cache responses. */
export function firebaseMessagingSwSource(config: MessagingSwConfig | null): string {
  const safe = usableConfig(config);
  const init = safe
    ? `firebase.initializeApp(${JSON.stringify(safe)});
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const data = payload && payload.data ? payload.data : {};
  const title = typeof data.title === "string" ? data.title : "Instox";
  const body = typeof data.body === "string" ? data.body : "Open Instox for the update.";
  const url = typeof data.url === "string" ? data.url : "/home";
  self.registration.showNotification(title, { body: body, data: { url: url } });
});`
    : "/* FCM web config is incomplete, so this worker will not register a token. */";
  return `/* Instox Firebase Cloud Messaging service worker. */
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");
${init}
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/home";
  event.waitUntil(self.clients.openWindow(url));
});
`;
}
