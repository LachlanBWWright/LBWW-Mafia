import { createClient, type Client } from "@libsql/client";

const globalForDb = globalThis as unknown as {
  client?: Client;
};

const defaultDatabaseUrl = "file:../nextjs/dev.db";

function getClient(): Client {
  if (globalForDb.client) return globalForDb.client;
  const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl;
  const client = createClient({ url: databaseUrl });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.client = client;
  }
  return client;
}

export const sharedDbClient: Client = new Proxy({} as Client, {
  get(_target, prop) {
    return (getClient() as never)[prop as keyof Client];
  },
});
