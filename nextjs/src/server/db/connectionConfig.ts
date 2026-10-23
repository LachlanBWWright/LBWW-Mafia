type DatabaseEnvironment = {
  DATABASE_URL?: string;
  DATABASE_URL_UNPOOLED?: string;
  DIRECT_MESSAGES_DATABASE_URL?: string;
};

function parseDatabaseUrl(value: string | undefined): URL {
  try {
    const url = new URL(value ?? "");
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname)
      throw new Error();
    return url;
  } catch {
    // Do not include connection strings or credentials in configuration errors.
    throw new Error("A valid PostgreSQL database URL is required.");
  }
}

function isNeon(url: URL) {
  return [".neon.tech", ".neon.build", ".neon.com"].some((suffix) =>
    url.hostname.endsWith(suffix),
  );
}

export function isNeonPooledUrl(value: string) {
  const url = parseDatabaseUrl(value);
  return isNeon(url) && url.hostname.split(".")[0]!.endsWith("-pooler");
}

/** postgres.js does not implement libpq's channel_binding URL option.
 * Neon connections use certificate-verified TLS instead; never forward that
 * option as an unsupported PostgreSQL startup parameter.
 */
export function postgresConnectionUrl(value: string) {
  const url = parseDatabaseUrl(value);
  if (!isNeon(url)) return value;
  url.searchParams.delete("channel_binding");
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

function requireSessionUrl(value: string | undefined, purpose: string) {
  parseDatabaseUrl(value);
  if (isNeonPooledUrl(value!))
    throw new Error(
      `${purpose} requires a direct PostgreSQL connection. Set DATABASE_URL_UNPOOLED to Neon's direct connection string.`,
    );
  return value!;
}

export function migrationDatabaseUrl(env: DatabaseEnvironment) {
  return requireSessionUrl(
    env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL,
    "Database migrations",
  );
}

export function messageDatabaseUrl(env: DatabaseEnvironment) {
  return requireSessionUrl(
    env.DIRECT_MESSAGES_DATABASE_URL ??
      env.DATABASE_URL_UNPOOLED ??
      env.DATABASE_URL,
    "Direct-message notifications",
  );
}

export function databaseConnectionOptions(url: string, production: boolean) {
  return {
    max: production ? 2 : 10,
    connect_timeout: 10,
    idle_timeout: 5,
    max_lifetime: 300,
    prepare: false,
    // Transaction poolers cannot preserve these session settings. Set timeout
    // defaults on the database role when using the Neon pooled endpoint.
    ...(isNeonPooledUrl(url)
      ? {}
      : {
          connection: {
            statement_timeout: 10000,
            idle_in_transaction_session_timeout: 10000,
          },
        }),
  };
}
