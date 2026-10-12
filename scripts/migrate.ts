import { migrateDatabase } from "../src/server/db/client";

migrateDatabase()
  .then(() => {
    console.log("Database schema is ready.");
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Migration failed");
    process.exit(1);
  });
