import { createTRPCRouter } from './trpc'
import { gameSessionRouter } from './routers/gameSession'
import { gameSessionDemoRouter } from './routers/gameSessionDemo'
import { authRouter } from './routers/auth'
import { userRouter } from './routers/user'
import { matchRouter } from './routers/match'
import { statsRouter } from './routers/stats'

export const appRouter = createTRPCRouter({
  auth: authRouter,
  user: userRouter,
  gameSession: gameSessionRouter,
  match: matchRouter,
  stats: statsRouter,
  demo: gameSessionDemoRouter,
})

export type AppRouter = typeof appRouter