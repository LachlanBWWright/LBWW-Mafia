import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { schema } from "./schema.js";

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
