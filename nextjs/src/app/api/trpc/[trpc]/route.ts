import {
  consumeLimit,
  guardRequest,
  readJson,
} from "~/server/reliability/requests";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { auth } from "~/server/auth";
import { appRouter } from "~/server/trpc/router";
import { env } from "~/env";
import { verifyMobileToken } from "~/server/auth/mobileToken";
import { getActiveIdentity } from "~/server/auth/identity";

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
  const mobileUser = authHeader?.startsWith("Bearer ")
    ? await verifyMobileToken(authHeader.slice(7))
    : null;
  const sessionUser = user?.id ? await getActiveIdentity(user.id) : null;
  const mobileIdentity = mobileUser
    ? await getActiveIdentity(mobileUser.sub)
    : null;
  const isBackend =
    !!env.BACKEND_SECRET && authHeader === `Bearer ${env.BACKEND_SECRET}`;

  return {
    sessionUser: sessionUser ?? mobileIdentity,
    isBackend,
    limitRequest: async (path: string, mutation: boolean) =>
      isBackend ||
      consumeLimit(
        `rpc:${(sessionUser ?? mobileIdentity)?.id ?? "anonymous"}:${path}`,
        mutation ? 60 : 300,
      ),
  };
};

/**
 * Handles incoming tRPC requests via HTTP (GET and POST).
 * Routes requests to the appropriate tRPC procedure and logs any errors.
 *
 * @param req - The incoming HTTP request
 * @returns The tRPC response
 */
const handler = async (req: Request) => {
  const limited = await guardRequest(req, "rpc", 600);
  if (limited) return limited;
  const paths = new URL(req.url).pathname.split("/").at(-1)?.split(",") ?? [];
  if (paths.length > 10)
    return Response.json({ error: "Batch too large" }, { status: 413 });
  if (req.method === "POST") {
    try {
      const maximum =
        req.headers.get("authorization") === `Bearer ${env.BACKEND_SECRET}`
          ? 8_388_608
          : 131_072;
      const body = await readJson(req, maximum);
      req = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        signal: req.signal,
        body: JSON.stringify(body),
      });
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 413 });
    }
  }
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError({ error, path }: { error: unknown; path: string | undefined }) {
      console.error(
        JSON.stringify({
          event: "rpc.error",
          requestId,
          path: path ?? "unknown",
          code: (error as { code?: string }).code,
        }),
      );
    },
  });
  response.headers.set("x-request-id", requestId);
  if (Date.now() - started > 1000)
    console.warn(
      JSON.stringify({
        event: "rpc.slow",
        requestId,
        durationMs: Date.now() - started,
      }),
    );
  return response;
};

export { handler as GET, handler as POST };
