import { AppError } from "@/lib/errors";
import { adminDb } from "@/server/db/admin";
import {
  isContentName,
  parseContent,
  publicRecord,
  tryParseContent,
  type ContentName,
  type ContentRecord,
} from "@/server/content/registry";

function sortValue(record: ContentRecord): number {
  return "sort" in record && typeof record.sort === "number" ? record.sort : 0;
}

export async function listContent<T extends ContentName>(name: T, scope: "public" | "admin"): Promise<ContentRecord<T>[]> {
  const snap = await adminDb().collection(name).limit(100).get();
  const rows: ContentRecord<T>[] = [];
  for (const doc of snap.docs) {
    const parsed = tryParseContent(name, { id: doc.id, ...doc.data() });
    if (!parsed) continue;
    if (scope === "public") {
      const visible = publicRecord(name, parsed);
      if (!visible) continue;
      rows.push(visible);
    } else {
      rows.push(parsed);
    }
  }
  return rows.sort((a, b) => sortValue(a) - sortValue(b) || a.id.localeCompare(b.id));
}

export async function saveContent<T extends ContentName>(name: T, input: unknown): Promise<ContentRecord<T>> {
  let parsed: ContentRecord<T>;
  try {
    parsed = parseContent(name, input);
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "That record does not match the collection.", {
      form: "Check the required fields.",
    });
  }
  await adminDb().collection(name).doc(parsed.id).set(parsed);
  return parsed;
}

export async function deleteContent(name: ContentName, id: string): Promise<void> {
  const ref = adminDb().collection(name).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError(404, "NOT_FOUND", "That record was not found.");
  await ref.delete();
}

export function assertContentName(value: string): ContentName {
  if (!isContentName(value)) throw new AppError(404, "NOT_FOUND", "Unknown content collection.");
  return value;
}
