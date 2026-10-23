import { afterEach, expect, it, vi } from "vitest";

const loadEnvConfig = vi.hoisted(() => vi.fn());
vi.mock("@next/env", () => ({ loadEnvConfig }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("loads CLI environment files and migrates through the direct URL without app credentials", async () => {
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://user:secret@ep-example-pooler.aws.neon.tech/mafia",
  );
  vi.stubEnv(
    "DATABASE_URL_UNPOOLED",
    "postgresql://user:secret@ep-example.aws.neon.tech/mafia",
  );
  vi.stubEnv("AUTH_GOOGLE_ID", undefined);
  vi.stubEnv("AUTH_GOOGLE_SECRET", undefined);
  vi.stubEnv("BACKEND_SECRET", undefined);
  const { default: config } = await import("../../../drizzle.config");
  expect(loadEnvConfig).toHaveBeenCalledWith(process.cwd());
  expect(config.dbCredentials.url).toBe(process.env.DATABASE_URL_UNPOOLED);
});
