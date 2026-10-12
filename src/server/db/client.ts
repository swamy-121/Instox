import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { AppError } from "@/lib/errors";
import * as schema from "@/server/db/schema";

export type Database = PostgresJsDatabase<typeof schema>;

let database: Database | null = null;
let client: ReturnType<typeof postgres> | null = null;

export function getDb(): Database {
  if (database) return database;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new AppError(503, "PROVIDER_UNAVAILABLE", "Set DATABASE_URL before using the database.");
  }
  client = postgres(url, { max: 10 });
  database = drizzle(client, { schema });
  return database;
}

export function setDb(next: Database): void {
  database = next;
}

export async function closeDb(): Promise<void> {
  if (client) await client.end({ timeout: 5 });
  client = null;
  database = null;
}

const MIGRATION_IDS = ["0000_init", "0001_crm_voice"] as const;

function readMigration(id: (typeof MIGRATION_IDS)[number]): string {
  return readFileSync(join(process.cwd(), `drizzle/${id}.sql`), "utf8");
}

export function migrationSql(): string {
  return MIGRATION_IDS.map((id) => readMigration(id)).join("\n");
}

export async function migrateDatabase(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new AppError(503, "PROVIDER_UNAVAILABLE", "Set DATABASE_URL before migrating.");
  }
  const sql = postgres(url, { max: 1 });
  try {
    for (const id of MIGRATION_IDS) {
      const applied = await sql<{ id: string }[]>`
        SELECT id FROM schema_migrations WHERE id = ${id}
      `.catch(() => []);
      if (applied.length > 0) continue;
      await sql.unsafe(readMigration(id));
      await sql`INSERT INTO schema_migrations (id) VALUES (${id}) ON CONFLICT (id) DO NOTHING`;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}
