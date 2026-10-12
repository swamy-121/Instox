import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { appSettings } from "@/server/db/schema";

export async function readSetting(key: string): Promise<Record<string, unknown> | null> {
  const rows = await getDb().select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function writeSetting(key: string, value: Record<string, unknown>, updatedBy?: string): Promise<void> {
  const now = new Date().toISOString();
  await getDb()
    .insert(appSettings)
    .values({ key, value, updatedBy: updatedBy ?? null, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedBy: updatedBy ?? null, updatedAt: now },
    });
}
