import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

const defaultDatabaseUrl = "file:../nextjs/dev.db";

function createDb() {
  const url = process.env.DATABASE_URL ?? defaultDatabaseUrl;
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}

// Cache the Drizzle instance so that the connection is reused between hot reloads in dev.
const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createDb> };

export const db: ReturnType<typeof createDb> =
  globalForDb.db ?? (globalForDb.db = createDb());
