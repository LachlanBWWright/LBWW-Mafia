import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

const gameSessionCreateInput = z.object({
  maxPlayers: z.number().min(4).max(20).default(10),
  settings: z.record(z.any()).optional(),
})

const gameSessionJoinInput = z.object({
  roomCode: z.string().min(1),
})

const gameSessionUpdateInput = z.object({
  gameSessionId: z.string(),
  status: z.enum(['WAITING', 'STARTING', 'IN_PROGRESS', 'FINISHED', 'CANCELLED']).optional(),
  settings: z.record(z.any()).optional(),
  result: z.record(z.any()).optional(),
})

export const gameSessionRouter = createTRPCRouter({
  // Create a new game session
  create: protectedProcedure
    .input(gameSessionCreateInput)
    .mutation(async ({ ctx, input }) => {
      // Generate a unique room code
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

      const gameSession = await ctx.prisma.gameSession.create({
        data: {
          roomId,
          roomCode,
          maxPlayers: input.maxPlayers,
          settings: input.settings || {},
          participants: {
            create: {
              userId: ctx.session.user.id,
              role: 'HOST',
            },
          },
        },
        include: {
          participants: {
            include: {
              user: true,
            },
          },
        },
      })

      return gameSession
    }),

  // Join an existing game session
  join: protectedProcedure
    .input(gameSessionJoinInput)
    .mutation(async ({ ctx, input }) => {
      const gameSession = await ctx.prisma.gameSession.findUnique({
        where: { roomCode: input.roomCode },
        include: {
          participants: true,
        },
      })

      if (!gameSession) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Game session not found',
        })
      }

      if (gameSession.status !== 'WAITING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Game has already started or finished',
        })
      }

      if (gameSession.participants.length >= gameSession.maxPlayers) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Game session is full',
        })
      }

      // Check if user is already in the session
      const existingParticipation = await ctx.prisma.gameParticipation.findUnique({
        where: {
          userId_gameSessionId: {
            userId: ctx.session.user.id,
            gameSessionId: gameSession.id,
          },
        },
      })

      if (existingParticipation) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You are already in this game session',
        })
      }

      await ctx.prisma.gameParticipation.create({
        data: {
          userId: ctx.session.user.id,
          gameSessionId: gameSession.id,
        },
      })

      // Return updated session
      return await ctx.prisma.gameSession.findUnique({
        where: { id: gameSession.id },
        include: {
          participants: {
            include: {
              user: true,
            },
          },
        },
      })
    }),

  // Leave a game session
  leave: protectedProcedure
    .input(z.object({ gameSessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const participation = await ctx.prisma.gameParticipation.findUnique({
        where: {
          userId_gameSessionId: {
            userId: ctx.session.user.id,
            gameSessionId: input.gameSessionId,
          },
        },
      })

      if (!participation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'You are not in this game session',
        })
      }

      await ctx.prisma.gameParticipation.update({
        where: { id: participation.id },
        data: { leftAt: new Date() },
      })

      return { success: true }
    }),

  // Get a specific game session
  get: publicProcedure
    .input(z.object({ roomCode: z.string() }))
    .query(async ({ ctx, input }) => {
      const gameSession = await ctx.prisma.gameSession.findUnique({
        where: { roomCode: input.roomCode },
        include: {
          participants: {
            where: { leftAt: null },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      })

      if (!gameSession) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Game session not found',
        })
      }

      return gameSession
    }),

  // Get all active game sessions (for lobbies list)
  getActive: publicProcedure
    .query(async ({ ctx }) => {
      const activeSessions = await ctx.prisma.gameSession.findMany({
        where: {
          status: 'WAITING',
        },
        include: {
          participants: {
            where: { leftAt: null },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return activeSessions
    }),

  // Update game session (for hosts/admin)
  update: protectedProcedure
    .input(gameSessionUpdateInput)
    .mutation(async ({ ctx, input }) => {
      // Check if user is the host or admin
      const participation = await ctx.prisma.gameParticipation.findUnique({
        where: {
          userId_gameSessionId: {
            userId: ctx.session.user.id,
            gameSessionId: input.gameSessionId,
          },
        },
      })

      if (!participation || participation.role !== 'HOST') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the host can update the game session',
        })
      }

      const updatedSession = await ctx.prisma.gameSession.update({
        where: { id: input.gameSessionId },
        data: {
          ...(input.status && { status: input.status }),
          ...(input.settings && { settings: input.settings }),
          ...(input.result && { result: input.result }),
          ...(input.status === 'IN_PROGRESS' && { startTime: new Date() }),
          ...(input.status && ['FINISHED', 'CANCELLED'].includes(input.status) && { endTime: new Date() }),
        },
        include: {
          participants: {
            include: {
              user: true,
            },
          },
        },
      })

      return updatedSession
    }),

  // Get user's game history
  getUserHistory: protectedProcedure
    .query(async ({ ctx }) => {
      const userSessions = await ctx.prisma.gameParticipation.findMany({
        where: {
          userId: ctx.session.user.id,
        },
        include: {
          gameSession: {
            include: {
              participants: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      image: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          joinedAt: 'desc',
        },
      })

      return userSessions.map((participation: any) => ({
        ...participation.gameSession,
        userRole: participation.role,
        userJoinedAt: participation.joinedAt,
        userLeftAt: participation.leftAt,
      }))
    }),
})