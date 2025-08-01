import { createTRPCRouter } from './trpc'
import { gameSessionRouter } from './routers/gameSession'

export const appRouter = createTRPCRouter({
  gameSession: gameSessionRouter,
})

export type AppRouter = typeof appRouter