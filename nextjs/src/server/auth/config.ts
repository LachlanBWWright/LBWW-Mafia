import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import {
  accounts,
  users,
  verificationTokens,
  userRoles,
} from "@mernmafia/db/schema";
import { getActiveIdentity } from "./identity";
import { googleCredentials } from "./googleConfiguration";

const google = googleCredentials();

function invalidateWebToken(token: JWT) {
  token.sub = undefined;
  token.name = undefined;
  token.email = undefined;
  token.picture = undefined;
  token.isAdmin = false;
  token.handle = null;
  return token;
}

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
  providers: google
    ? [
        GoogleProvider({
          ...google,
          checks: ["pkce", "state", "nonce"],
          allowDangerousEmailAccountLinking: false,
        }),
      ]
    : [],
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  callbacks: {
    signIn: ({ account, profile }) =>
      account?.provider === "google" && profile?.email_verified === true,
    jwt: async ({ token, user, account: providerAccount }) => {
      if (providerAccount) token.provider = providerAccount.provider;
      if (token.provider !== "google") {
        return invalidateWebToken(token);
      }
      const userId = user?.id ?? token.sub;
      if (!userId) return invalidateWebToken(token);
      const [account] = await db
        .select({ authVersion: users.authVersion })
        .from(users)
        .where(eq(users.id, userId));
      if (user) token.authVersion = account?.authVersion;
      if (!account || token.authVersion !== account.authVersion) {
        return invalidateWebToken(token);
      }
      const identity = await getActiveIdentity(userId);
      token.kind = "web";
      token.isAdmin = identity?.isAdmin ?? false;
      token.handle = identity?.handle ?? null;
      if (!identity) return invalidateWebToken(token);
      return token;
    },
    session: ({ session, token }) => {
      return {
        ...session,
        user: {
          ...(token.sub
            ? session.user
            : { name: null, email: null, image: null }),
          id: token.sub ?? "",
          isAdmin: Boolean(token.sub && token.isAdmin),
          handle:
            token.sub && typeof token.handle === "string" ? token.handle : null,
        },
      };
    },
  },
  events: {
    createUser: async ({ user }) => {
      if (user.id)
        await db
          .insert(userRoles)
          .values({ userId: user.id, role: "player" })
          .onConflictDoNothing();
    },
  },
} satisfies NextAuthConfig;
