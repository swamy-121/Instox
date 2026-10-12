export const INTEGRATION_GROUPS = ["payments", "razorpay", "cashfree", "aliceblue", "fcm"] as const;
export type IntegrationGroup = (typeof INTEGRATION_GROUPS)[number];

export type IntegrationField = {
  key: string;
  group: IntegrationGroup;
  label: string;
  secret: boolean;
  options?: string[];
};

export const INTEGRATION_FIELDS: IntegrationField[] = [
  { key: "PAYMENTS_PROVIDER", group: "payments", label: "Payment provider", secret: false, options: ["stub", "razorpay", "cashfree"] },
  { key: "RAZORPAY_KEY_ID", group: "razorpay", label: "Key id", secret: true },
  { key: "RAZORPAY_KEY_SECRET", group: "razorpay", label: "Key secret", secret: true },
  { key: "RAZORPAY_WEBHOOK_SECRET", group: "razorpay", label: "Webhook secret", secret: true },
  { key: "CASHFREE_CLIENT_ID", group: "cashfree", label: "Client id", secret: true },
  { key: "CASHFREE_CLIENT_SECRET", group: "cashfree", label: "Client secret", secret: true },
  { key: "CASHFREE_WEBHOOK_SECRET", group: "cashfree", label: "Webhook secret", secret: true },
  { key: "MARKET_DATA_PROVIDER", group: "aliceblue", label: "Market data provider", secret: false, options: ["", "aliceblue", "dev"] },
  { key: "ALICEBLUE_APP_CODE", group: "aliceblue", label: "App code", secret: true },
  { key: "ALICEBLUE_API_SECRET", group: "aliceblue", label: "API secret", secret: true },
  { key: "FCM_SEND_MODE", group: "fcm", label: "Send mode", secret: false, options: ["token", "topic"] },
  { key: "NEXT_PUBLIC_FIREBASE_VAPID_KEY", group: "fcm", label: "Web push key", secret: true },
];

export const INTEGRATION_KEYS = INTEGRATION_FIELDS.map((field) => field.key);

export function integrationField(key: string): IntegrationField | undefined {
  return INTEGRATION_FIELDS.find((field) => field.key === key);
}

export function validFieldValue(field: IntegrationField, value: string): boolean {
  if (value.length > 500) return false;
  if (field.options) return field.options.includes(value);
  return true;
}
