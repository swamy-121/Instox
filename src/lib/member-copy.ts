/** Copy and switches the member app reads. Admin edits the same fields on appConfig/public. */

export type MemberCopy = {
  greetingPrefix: string;
  greetingSubtitle: string;
  homePicksTitle: string;
  paymentSuccessTitle: string;
  paymentSuccessBody: string;
  paymentSuccessCta: string;
  settingsIntro: string;
  helpTitle: string;
  premiumTitle: string;
  popularBadge: string;
  appVersion: string;
  maintenance: boolean;
  maintenanceTitle: string;
  maintenanceBody: string;
  tipPushDefault: boolean;
  marketingPushDefault: boolean;
};

export const MEMBER_COPY_DEFAULTS: MemberCopy = {
  greetingPrefix: "Hi",
  greetingSubtitle: "Let us find your next opportunity",
  homePicksTitle: "Today's top picks",
  paymentSuccessTitle: "Payment successful",
  paymentSuccessBody: "Your order is saved.",
  paymentSuccessCta: "Go to home",
  settingsIntro: "Notification choices are saved on your account.",
  helpTitle: "Help and support",
  premiumTitle: "Go Premium",
  popularBadge: "Most popular",
  appVersion: "1.0.0",
  maintenance: false,
  maintenanceTitle: "Instox is briefly unavailable",
  maintenanceBody: "Please try again shortly.",
  tipPushDefault: false,
  marketingPushDefault: false,
};

export const MEMBER_COPY_KEYS = Object.keys(MEMBER_COPY_DEFAULTS) as Array<keyof MemberCopy>;

/** Success copy must not tell the member that premium was granted. */
export function claimsPremiumGrant(title: string, body: string): boolean {
  const text = `${title} ${body}`;
  return /premium/i.test(text) && /(grant|unlock|activat|enabled|now have|you have|is active)/i.test(text);
}
