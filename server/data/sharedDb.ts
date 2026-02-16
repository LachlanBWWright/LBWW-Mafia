import { createClient, type Client } from "@libsql/client";

const globalForDb = globalThis as unknown as {
  client?: Client;
};

const defaultDatabaseUrl = "file:../nextjs/dev.db";
const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl;

export const sharedDbClient =
  globalForDb.client ??
  createClient({
    url: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = sharedDbClient;
}
