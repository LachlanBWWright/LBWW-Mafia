import { afterEach, describe, expect, it, vi } from "vitest";

function configure(mode: "development" | "production") {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", mode);
  vi.stubEnv("SKIP_ENV_VALIDATION", "");
  vi.stubEnv("AUTH_SECRET", "test-auth-secret");
  vi.stubEnv("AUTH_GOOGLE_ID", "");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "");
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/mafia",
  );
  vi.stubEnv("DATABASE_URL_UNPOOLED", "");
  vi.stubEnv("DIRECT_MESSAGES_DATABASE_URL", "");
  vi.stubEnv("BACKEND_SECRET", "test-backend-secret");
  vi.stubEnv("NEXT_PUBLIC_SOCKET_URL", "http://localhost:1999");
  vi.stubEnv("NEXT_PUBLIC_SOCKET_BACKEND", "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("Google OAuth environment requirements", () => {
  it("allows local development with blank Google credentials", async () => {
    configure("development");
    const { env } = await import("./env.js");
    expect(env.AUTH_GOOGLE_ID).toBeUndefined();
    expect(env.AUTH_GOOGLE_SECRET).toBeUndefined();
  });

  it.each(["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"] as const)(
    "requires %s in production",
    async (missing) => {
      configure("production");
      vi.stubEnv("AUTH_GOOGLE_ID", "configured-id");
      vi.stubEnv("AUTH_GOOGLE_SECRET", "configured-secret");
      vi.stubEnv(missing, "");
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      await expect(import("./env.js")).rejects.toThrow(
        "Invalid environment variables",
      );
    },
  );

  it("preserves configured credentials in development", async () => {
    configure("development");
    vi.stubEnv("AUTH_GOOGLE_ID", "real-development-id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "real-development-secret");
    const { env } = await import("./env.js");
    expect(env.AUTH_GOOGLE_ID).toBe("real-development-id");
    expect(env.AUTH_GOOGLE_SECRET).toBe("real-development-secret");
  });
});

describe("game Worker environment", () => {
  it("defaults to PartyServer when no backend is configured", async () => {
    configure("development");
    const { env } = await import("./env.js");
    expect(env.NEXT_PUBLIC_SOCKET_BACKEND).toBe("partyserver");
  });

  it("accepts a deployed Cloudflare Worker origin", async () => {
    configure("development");
    vi.stubEnv("NEXT_PUBLIC_SOCKET_BACKEND", "partyserver");
    vi.stubEnv(
      "NEXT_PUBLIC_SOCKET_URL",
      "https://mafia-game.example.workers.dev",
    );
    const { env } = await import("./env.js");
    expect(env.NEXT_PUBLIC_SOCKET_BACKEND).toBe("partyserver");
    expect(env.NEXT_PUBLIC_SOCKET_URL).toBe(
      "https://mafia-game.example.workers.dev",
    );
  });

  it("rejects unknown backend names instead of accepting a retired configuration", async () => {
    configure("development");
    vi.stubEnv("NEXT_PUBLIC_SOCKET_BACKEND", "retired-backend");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(import("./env.js")).rejects.toThrow(
      "Invalid environment variables",
    );
  });
});
