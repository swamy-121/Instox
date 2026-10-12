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

export function migrationSql(): string {
  return readFileSync(join(process.cwd(), "drizzle/0000_init.sql"), "utf8");
}

export async function migrateDatabase(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new AppError(503, "PROVIDER_UNAVAILABLE", "Set DATABASE_URL before migrating.");
  }
  const sql = postgres(url, { max: 1 });
  try {
    const applied = await sql<{ id: string }[]>`
      SELECT id FROM schema_migrations WHERE id = '0000_init'
    `.catch(() => []);
    if (applied.length > 0) return;
    await sql.unsafe(migrationSql());
    await sql`INSERT INTO schema_migrations (id) VALUES ('0000_init') ON CONFLICT (id) DO NOTHING`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
