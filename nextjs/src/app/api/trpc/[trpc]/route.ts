import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { auth } from "~/server/auth";
import { appRouter } from "~/server/trpc/router";

const createContext = async () => {
  const session = await auth();
  const user = session?.user;

  return {
    sessionUser: user
      ? {
          id: user.id,
          name: user.name,
          isAdmin: user.isAdmin,
        }
      : null,
  };
};

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`tRPC failed on ${path ?? "unknown"}:`, error);
    },
  });

export { handler as GET, handler as POST };
