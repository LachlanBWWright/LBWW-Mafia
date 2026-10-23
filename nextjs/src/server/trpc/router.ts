import {
  createAppRouter,
  type AppRouter as SharedAppRouter,
} from "@mernmafia/shared/trpc/appRouter";
import { trpcServices } from "./services";

/**
 * tRPC app router instance configured with all game services.
 * Provides typed RPC endpoints for match history, user search, and admin operations.
 */
export const appRouter: SharedAppRouter = createAppRouter(trpcServices);

export type AppRouter = typeof appRouter;
