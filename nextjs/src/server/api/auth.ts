import NextAuth, { type NextAuthOptions, type Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "~/lib/prisma";
import type { DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { NextRequest } from "next/server";

// Augment NextAuth Session type to include id on user
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & { id: string };
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    session: ({
      session,
      token,
    }: {
      session: Session;
      token: JWT;
    }): Session => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub ?? "anonymous_user",
      },
    }),
    jwt: ({ token, user, account }: { token: JWT; user?: any; account?: any }) => {
      if (user) {
        token.sub = user.id;
      }
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
};

// NextAuth instance - NextAuth library does not provide complete TypeScript types
const authInstance: unknown = NextAuth(authOptions);

// Export handlers if available at runtime (typed for Next.js route compatibility)
export type NextAuthHandler = (
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> },
) => void | Response | Promise<void | Response>;

let handlersVar: NextAuthHandler | undefined = undefined;

if (
  isAuthInstance(authInstance) &&
  typeof authInstance.handlers === "function"
) {
  handlersVar = authInstance.handlers as NextAuthHandler;
}

export const handlers = handlersVar;

function isAuthInstance(obj: unknown): obj is {
  auth: () => Promise<Session | null>;
  signIn?: (...args: unknown[]) => Promise<void>;
  signOut?: (...args: unknown[]) => Promise<void>;
  handlers?: unknown;
} {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "auth" in obj &&
    typeof (obj as { auth?: unknown }).auth === "function"
  );
}

const authFn = async (): Promise<Session | null> => {
  if (isAuthInstance(authInstance)) {
    try {
      return await authInstance.auth();
    } catch {
      return null;
    }
  }
  return null;
};

export const auth = authFn;

export const signIn =
  isAuthInstance(authInstance) && authInstance.signIn
    ? authInstance.signIn
    : (): Promise<void> => Promise.resolve();

export const signOut =
  isAuthInstance(authInstance) && authInstance.signOut
    ? authInstance.signOut
    : (): Promise<void> => Promise.resolve();
