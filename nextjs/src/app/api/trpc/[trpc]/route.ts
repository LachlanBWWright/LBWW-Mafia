import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { auth } from "~/server/auth";
import { appRouter } from "~/server/trpc/router";
import { env } from "~/env";

const createContext = async ({ req }: { req: Request }) => {
  const session = await auth();
  const user = session?.user;

  const authHeader = req.headers.get("authorization");
  const isBackend =
    !!env.BACKEND_SECRET &&
    authHeader === `Bearer ${env.BACKEND_SECRET}`;

  return {
    sessionUser: user
      ? {
          id: user.id,
          name: user.name,
          isAdmin: user.isAdmin,
        }
      : null,
    isBackend,
  };
};

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
