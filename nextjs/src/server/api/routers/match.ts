import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const matchRouter = createTRPCRouter({
  // Get user's match history with pagination
  getHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
      filter: z.object({
        status: z.enum(['FINISHED', 'CANCELLED']).optional(),
        role: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { limit, cursor, filter } = input;

      const participations = await ctx.prisma.gameParticipation.findMany({
        where: {
          userId: ctx.session.user.id,
          gameSession: {
            status: filter?.status ?? 'FINISHED',
          },
          ...(filter?.role && { role: filter.role }),
          ...(filter?.dateFrom && { joinedAt: { gte: filter.dateFrom } }),
          ...(filter?.dateTo && { joinedAt: { lte: filter.dateTo } }),
        },
        include: {
          gameSession: {
            select: {
              id: true,
              roomCode: true,
              status: true,
              startTime: true,
              endTime: true,
              result: true,
              _count: {
                select: { participants: true },
              },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
      });

      let nextCursor: string | undefined = undefined;
      if (participations.length > limit) {
        const nextItem = participations.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items: participations,
        nextCursor,
      };
    }),

  // Get match details
  getMatchDetails: protectedProcedure
    .input(z.object({ gameSessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.prisma.gameSession.findUnique({
        where: { id: input.gameSessionId },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  image: true,
                },
              },
            },
          },
        },
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Game session not found',
        });
      }

      // Only return if user participated
      const participated = session.participants.some(
        p => p.userId === ctx.session.user.id
      );

      if (!participated) {
        throw new TRPCError({ 
          code: 'FORBIDDEN',
          message: 'You did not participate in this game',
        });
      }

      return session;
    }),

  // Get match summary for sharing (public)
  getMatchSummary: publicProcedure
    .input(z.object({ gameSessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.gameSession.findUnique({
        where: { id: input.gameSessionId },
        select: {
          id: true,
          roomCode: true,
          startTime: true,
          endTime: true,
          result: true,
          _count: {
            select: { participants: true },
          },
        },
      });
    }),
});
