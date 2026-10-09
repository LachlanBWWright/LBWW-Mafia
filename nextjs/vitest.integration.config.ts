import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
if (!process.env.DATABASE_URL?.startsWith("postgres"))
  throw new Error(
    "Integration tests require a dedicated PostgreSQL DATABASE_URL",
  );
export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    env: {
      AUTH_SECRET: "integration-auth",
      AUTH_GOOGLE_ID: "integration",
      AUTH_GOOGLE_SECRET: "integration",
      BACKEND_SECRET: "integration-backend",
      NEXT_PUBLIC_SOCKET_URL: "http://127.0.0.1:1999",
    },
  },
  resolve: {
    alias: {
      "@mernmafia/shared": resolve(__dirname, "../shared"),
      "~": resolve(__dirname, "./src/"),
    },
  },
});
