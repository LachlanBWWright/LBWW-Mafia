import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "~/env";
import { schema } from "@mernmafia/db/schema";
import {
  databaseConnectionOptions,
  postgresConnectionUrl,
} from "./connectionConfig";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn =
  globalForDb.conn ??
  postgres(
    postgresConnectionUrl(env.DATABASE_URL),
    databaseConnectionOptions(env.DATABASE_URL, env.NODE_ENV === "production"),
  );
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

/**
 * Drizzle ORM database client.
 * Provides typed access to all database tables via `db.query.*` and mutation methods.
 */
export const db = drizzle(conn, { schema });
