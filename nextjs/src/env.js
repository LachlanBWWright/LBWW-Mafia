import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const postgresUrl = z
  .string()
  .url()
  .regex(/^postgres(ql)?:\/\//, "A PostgreSQL URL is required");

// Public pages and guest games can run locally before Google OAuth is set up.
// Deployed builds still require real credentials.
const googleCredential =
  process.env.NODE_ENV === "development"
    ? z.string().optional()
    : z.string().min(1);

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_GOOGLE_ID: googleCredential,
    AUTH_GOOGLE_SECRET: googleCredential,
    DATABASE_URL: postgresUrl,
    DATABASE_URL_UNPOOLED: postgresUrl.optional(),
    DIRECT_MESSAGES_DATABASE_URL: postgresUrl.optional(),
    BACKEND_SECRET: z.string(),
    MOBILE_AUTH_SECRET: z.string().min(32).optional(),
    TRUSTED_CLIENT_IP_HEADER: z.string().optional(),
    PLAYWRIGHT_NO_DB: z.string().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_SOCKET_BACKEND: z
      .enum(["socketio", "partyserver", "supabase"])
      .default("partyserver"),
    NEXT_PUBLIC_SOCKET_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
    DIRECT_MESSAGES_DATABASE_URL: process.env.DIRECT_MESSAGES_DATABASE_URL,
    BACKEND_SECRET: process.env.BACKEND_SECRET,
    MOBILE_AUTH_SECRET: process.env.MOBILE_AUTH_SECRET,
    TRUSTED_CLIENT_IP_HEADER: process.env.TRUSTED_CLIENT_IP_HEADER,
    PLAYWRIGHT_NO_DB: process.env.PLAYWRIGHT_NO_DB,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SOCKET_BACKEND: process.env.NEXT_PUBLIC_SOCKET_BACKEND,
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
