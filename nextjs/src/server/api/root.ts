import { createTRPCRouter } from './trpc'
import { gameSessionRouter } from './routers/gameSession'
import { gameSessionDemoRouter } from './routers/gameSessionDemo'

export const appRouter = createTRPCRouter({
  gameSession: gameSessionRouter,
  demo: gameSessionDemoRouter,
})

export type AppRouter = typeof appRouter