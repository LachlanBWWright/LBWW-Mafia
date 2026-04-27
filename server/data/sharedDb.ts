import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { schema } from "./schema.js";

/**
 * Creates and returns a Drizzle ORM instance for database access.
 * Uses environment variables to configure the database connection URL and authentication token.
 * 
 * @returns {ReturnType<typeof drizzle>} A Drizzle ORM instance with the configured schema
 */
function createDb() {
  const url = process.env.DATABASE_URL ?? "file:../nextjs/dev.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}

// Cache the Drizzle instance so that the connection is reused between hot reloads in dev.
const globalForDb = globalThis as unknown as {
  db?: ReturnType<typeof createDb>;
};

export const db: ReturnType<typeof createDb> =
  globalForDb.db ?? (globalForDb.db = createDb());
