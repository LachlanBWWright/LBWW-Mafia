import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "../../db/schema.js";

const globalForDb = globalThis as unknown as {
  client?: Client;
};

const defaultDatabaseUrl = "file:../nextjs/dev.db";
const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl;

const client =
  globalForDb.client ??
  createClient({
    url: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

export const sharedDb = drizzle(client, { schema });
