import { type Config } from "drizzle-kit";
import { loadEnvConfig } from "@next/env";
import { migrationDatabaseUrl } from "./src/server/db/connectionConfig";

// Drizzle runs outside Next.js. Load .env.local without requiring OAuth or
// WebSocket configuration just to migrate the database.
loadEnvConfig(process.cwd());

export default {
  schema: "../db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationDatabaseUrl({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
    }),
  },
  tablesFilter: ["nextjs_*"],
} satisfies Config;
