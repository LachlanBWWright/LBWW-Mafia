import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "~/env";
import { schema } from "@mernmafia/db/schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn =
  globalForDb.conn ??
  postgres(env.DATABASE_URL, {
    max: 10,
    connect_timeout: 10,
    idle_timeout: 20,
    connection: {
      statement_timeout: 10000,
      idle_in_transaction_session_timeout: 10000,
    },
  });
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

/**
 * Drizzle ORM database client.
 * Provides typed access to all database tables via `db.query.*` and mutation methods.
 */
export const db = drizzle(conn, { schema });
