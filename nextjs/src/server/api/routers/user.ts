import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

export const userRouter = createTRPCRouter({
  // Get current user profile
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      include: {
        _count: {
          select: { gameParticipations: true },
        },
        preferences: true,
        stats: true,
      },
    });
  }),

  // Get public user profile by ID
  getPublicProfile: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          displayName: true,
          image: true,
          createdAt: true,
          _count: {
            select: { gameParticipations: true },
          },
          stats: {
            select: {
              totalGames: true,
              totalWins: true,
            },
          },
        },
      });
    }),

  // Update profile
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(50).optional(),
      displayName: z.string().min(1).max(30).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: input,
      });
    }),

  // Get user preferences
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    let prefs = await ctx.prisma.userPreferences.findUnique({
      where: { userId: ctx.session.user.id },
    });

    // Create default preferences if they don't exist
    if (!prefs) {
      prefs = await ctx.prisma.userPreferences.create({
        data: {
          userId: ctx.session.user.id,
        },
      });
    }

    return prefs;
  }),

  // Update user preferences
  updatePreferences: protectedProcedure
    .input(z.object({
      soundEnabled: z.boolean().optional(),
      notificationsEnabled: z.boolean().optional(),
      theme: z.enum(['light', 'dark', 'system']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.userPreferences.upsert({
        where: { userId: ctx.session.user.id },
        create: { userId: ctx.session.user.id, ...input },
        update: input,
      });
    }),
});
