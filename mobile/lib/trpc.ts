import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../shared/trpc/appRouter";

const defaultTrpcUrl = "http://localhost:3000/api/trpc";
const trpcUrl = process.env.EXPO_PUBLIC_TRPC_URL ?? defaultTrpcUrl;

export const trpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: trpcUrl,
      transformer: superjson,
    }),
  ],
});
