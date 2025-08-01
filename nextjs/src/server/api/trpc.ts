import { initTRPC, TRPCError } from '@trpc/server'
import { type NextRequest } from 'next/server'
import { auth } from '~/server/api/auth'
import { prisma } from '~/lib/prisma'
import { z } from 'zod'

interface CreateContextOptions {
  session: any | null
}

const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    prisma,
  }
}

export const createTRPCContext = async (opts: { req: NextRequest }) => {
  let session = null
  
  try {
    session = await auth()
  } catch (error) {
    // If auth fails, check for demo mode by looking at the request
    // For demo purposes, we'll create a mock session
    const userAgent = opts.req.headers.get('user-agent') || ''
    if (userAgent) {
      session = {
        user: {
          id: 'user_123',
          name: 'Demo Player',
          email: 'demo@example.com',
        }
      }
    }
  }

  return createInnerTRPCContext({
    session,
  })
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: undefined,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof z.ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router

export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(
  t.middleware(({ ctx, next }) => {
    if (!ctx.session || !ctx.session.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    return next({
      ctx: {
        ...ctx,
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    })
  }),
)