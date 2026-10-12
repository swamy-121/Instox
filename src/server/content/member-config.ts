import { z } from "zod";
import { AppError } from "@/lib/errors";
import { claimsPremiumGrant, MEMBER_COPY_DEFAULTS, MEMBER_COPY_KEYS, type MemberCopy } from "@/lib/member-copy";
import { readSetting, writeSetting } from "@/server/db/settings";

const memberCopySchema = z
  .object({
    greetingPrefix: z.string().trim().min(1).max(20),
    greetingSubtitle: z.string().trim().min(1).max(120),
    homePicksTitle: z.string().trim().min(1).max(80),
    paymentSuccessTitle: z.string().trim().min(1).max(80),
    paymentSuccessBody: z.string().trim().min(1).max(240),
    paymentSuccessCta: z.string().trim().min(1).max(40),
    settingsIntro: z.string().trim().min(1).max(240),
    helpTitle: z.string().trim().min(1).max(80),
    premiumTitle: z.string().trim().min(1).max(80),
    popularBadge: z.string().trim().min(1).max(40),
    appVersion: z.string().trim().min(1).max(20),
    maintenance: z.boolean(),
    maintenanceTitle: z.string().trim().min(1).max(80),
    maintenanceBody: z.string().trim().min(1).max(240),
    tipPushDefault: z.boolean(),
    marketingPushDefault: z.boolean(),
  })
  .strict();

export function memberCopyFromValue(value: unknown): MemberCopy {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const merged: Record<string, unknown> = { ...MEMBER_COPY_DEFAULTS };
  for (const key of MEMBER_COPY_KEYS) {
    if (source[key] !== undefined) merged[key] = source[key];
  }
  const parsed = memberCopySchema.safeParse(merged);
  return parsed.success ? parsed.data : MEMBER_COPY_DEFAULTS;
}

export function parseMemberCopy(input: unknown): MemberCopy {
  const parsed = memberCopySchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Check the member copy fields.", {
      form: "Each label needs text, and the switches need to be on or off.",
    });
  }
  if (claimsPremiumGrant(parsed.data.paymentSuccessTitle, parsed.data.paymentSuccessBody)) {
    throw new AppError(400, "VALIDATION_ERROR", "Payment success copy cannot say premium was granted.", {
      paymentSuccessBody: "Describe the saved order only.",
    });
  }
  return parsed.data;
}

export async function loadMemberCopy(): Promise<MemberCopy> {
  const value = await readSetting("public");
  const nested = value?.value;
  return memberCopyFromValue(nested ?? value);
}

export async function saveMemberCopy(copy: MemberCopy, updatedBy: string): Promise<MemberCopy> {
  const current = (await readSetting("public")) ?? {};
  const nested = current.value && typeof current.value === "object" ? (current.value as Record<string, unknown>) : current;
  await writeSetting("public", { ...current, key: "public", value: { ...nested, ...copy } }, updatedBy);
  return copy;
}
