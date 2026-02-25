import {
  createAppRouter,
  type AppRouter as SharedAppRouter,
} from "@mernmafia/shared/trpc/appRouter";
import { trpcServices } from "./services";

export const appRouter: SharedAppRouter = createAppRouter(trpcServices);

export type AppRouter = typeof appRouter;
