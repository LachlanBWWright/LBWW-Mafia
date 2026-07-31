import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { auth } from "~/server/auth";
import { appRouter } from "~/server/trpc/router";
import { env } from "~/env";
import { verifyMobileToken } from "~/server/auth/mobileToken";
import { db } from "~/server/db";
import { userRoles } from "@mernmafia/db/schema";
import { eq } from "drizzle-orm";

/**
 * Creates the tRPC context for each request, including authentication info.
 * Authenticates the user via NextAuth session or backend bearer token.
 *
 * @param req - The incoming HTTP request
 * @returns>} Context with authenticated user and backend flag
 */
const createContext = async ({ req }: { req: Request }) => {
  const session = await auth();
  const user = session?.user;

  const authHeader = req.headers.get("authorization");
  const mobileUser = authHeader?.startsWith("Bearer ") ? verifyMobileToken(authHeader.slice(7)) : null;
  const authenticatedId = user?.id ?? mobileUser?.userId;
  const roles = authenticatedId
    ? (await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, authenticatedId))).map((row) => row.role)
    : [];
  const isBackend =
    !!env.BACKEND_SECRET &&
    authHeader === `Bearer ${env.BACKEND_SECRET}`;

  return {
    sessionUser: user
      ? {
          id: user.id,
          name: user.name,
          isAdmin: user.isAdmin,
          roles,
        }
      : mobileUser ? { id: mobileUser.userId, name: mobileUser.name, isAdmin: Boolean(mobileUser.isAdmin), roles } : null,
    isBackend,
  };
};

/**
 * Handles incoming tRPC requests via HTTP (GET and POST).
 * Routes requests to the appropriate tRPC procedure and logs any errors.
 *
 * @param req - The incoming HTTP request
 * @returns The tRPC response
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError({ error, path }: { error: unknown; path: string | undefined }) {
      console.error(`tRPC failed on ${path ?? "unknown"}:`, error);
    },
  });

export { handler as GET, handler as POST };
