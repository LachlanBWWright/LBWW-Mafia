import { describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  databaseConnectionOptions,
  isNeonPooledUrl,
  messageDatabaseUrl,
  migrationDatabaseUrl,
  postgresConnectionUrl,
} from "./connectionConfig";

const pooled =
  "postgresql://app:secret@ep-example-pooler.ap-southeast-2.aws.neon.tech/mafia?sslmode=require&channel_binding=require";
const direct = pooled.replace("-pooler", "");
const local = "postgresql://postgres:postgres@localhost:5432/mafia";

describe("Vercel Neon connections", () => {
  it("routes migrations and notifications to the integration's unpooled URL", () => {
    const env = { DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: direct };
    expect(migrationDatabaseUrl(env)).toBe(direct);
    expect(messageDatabaseUrl(env)).toBe(direct);
  });

  it("retains an explicit message connection override without changing migrations", () => {
    const override = direct.replace("app:secret", "notifications:secret");
    const env = {
      DATABASE_URL: pooled,
      DATABASE_URL_UNPOOLED: direct,
      DIRECT_MESSAGES_DATABASE_URL: override,
    };
    expect(messageDatabaseUrl(env)).toBe(override);
    expect(migrationDatabaseUrl(env)).toBe(direct);
  });

  it("keeps local PostgreSQL usable without separate connection strings", () => {
    expect(migrationDatabaseUrl({ DATABASE_URL: local })).toBe(local);
    expect(messageDatabaseUrl({ DATABASE_URL: local })).toBe(local);
    expect(postgresConnectionUrl(local)).toBe(local);
  });

  it("rejects pooled connections for session-dependent work without leaking credentials", () => {
    for (const resolve of [migrationDatabaseUrl, messageDatabaseUrl]) {
      expect(() => resolve({ DATABASE_URL: pooled })).toThrow(
        "Set DATABASE_URL_UNPOOLED",
      );
      expect(() =>
        resolve({ DATABASE_URL: local, DATABASE_URL_UNPOOLED: pooled }),
      ).toThrow("direct PostgreSQL connection");
      try {
        resolve({ DATABASE_URL: pooled });
      } catch (error) {
        expect(String(error)).not.toContain("secret");
      }
    }
    expect(() =>
      messageDatabaseUrl({
        DATABASE_URL: local,
        DIRECT_MESSAGES_DATABASE_URL: pooled,
      }),
    ).toThrow("direct PostgreSQL connection");
  });

  it.each([undefined, "", "https://example.com", "postgresql://"])(
    "rejects an invalid database URL (%s)",
    (url) => {
      expect(() => migrationDatabaseUrl({ DATABASE_URL: url })).toThrow(
        "valid PostgreSQL database URL",
      );
    },
  );

  it("does not mistake unrelated hosts or a pooler word in a password for Neon pooling", () => {
    expect(isNeonPooledUrl(pooled)).toBe(true);
    expect(isNeonPooledUrl(direct)).toBe(false);
    expect(
      isNeonPooledUrl(local.replace("postgres:postgres", "postgres:pooler")),
    ).toBe(false);
    expect(
      isNeonPooledUrl(pooled.replace(".neon.tech", ".neon.tech.example.com")),
    ).toBe(false);
  });

  it.each([pooled, direct])(
    "accepts a Neon console URL in postgres.js with verified TLS (%s)",
    async (url) => {
      const client = postgres(
        postgresConnectionUrl(url),
        databaseConnectionOptions(url, true),
      );
      try {
        expect(client.options.ssl).toBe("verify-full");
        expect(client.options.connection).not.toHaveProperty("channel_binding");
        expect(client.options.host[0]).toBe(new URL(url).hostname);
        expect(client.options.database).toBe("mafia");
        expect(client.options.max).toBe(2);
        expect(client.options.prepare).toBe(false);
      } finally {
        await client.end();
      }
    },
  );

  it("keeps incompatible startup settings out of pooled connections", () => {
    const pooledOptions = databaseConnectionOptions(pooled, true);
    expect(pooledOptions).not.toHaveProperty("connection");
    expect(pooledOptions.idle_timeout).toBe(5);
    expect(pooledOptions.connect_timeout).toBe(10);
    expect(databaseConnectionOptions(local, false).connection).toEqual({
      statement_timeout: 10000,
      idle_in_transaction_session_timeout: 10000,
    });
  });
});
