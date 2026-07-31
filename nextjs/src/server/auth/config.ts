import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
  userRoles,
} from "@mernmafia/db/schema";
import { verifyPassword } from "./password";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      isAdmin: boolean;
      handle?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    isAdmin: boolean;
    handle?: string | null;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Email and password",
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = z.object({ email: z.string().email(), password: z.string().min(1) })
          .safeParse(credentials);
        if (!parsed.success) return null;
        const [user] = await db.select().from(users)
          .where(eq(users.email, parsed.data.email.trim().toLowerCase())).limit(1);
        if (!user?.passwordHash || user.deletedAt || user.accountStatus !== "active") return null;
        if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return null;
        return { id: user.id, name: user.name, email: user.email, image: user.image, isAdmin: user.isAdmin, handle: user.handle };
      },
    }),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  callbacks: {
    jwt: async ({ token, user }) => {
      const userId = user?.id ?? token.sub;
      if (!userId) return token;
      const [record] = await db.select({ isAdmin: users.isAdmin, handle: users.handle })
        .from(users).where(eq(users.id, userId)).limit(1);
      token.isAdmin = record?.isAdmin ?? false;
      token.handle = record?.handle ?? null;
      return token;
    },
    session: ({ session, token }) => {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub ?? "",
          isAdmin: Boolean(token.isAdmin),
          handle: typeof token.handle === "string" ? token.handle : null,
        },
      };
    },
  },
  events: {
    createUser: async ({ user }) => {
      if (user.id) await db.insert(userRoles).values({ userId: user.id, role: "player" }).onConflictDoNothing();
    },
  },
} satisfies NextAuthConfig;
