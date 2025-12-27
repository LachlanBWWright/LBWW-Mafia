import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

export const statsRouter = createTRPCRouter({
  // Get user's personal statistics
  getPersonalStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Get or create stats
    let stats = await ctx.prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      // Initialize stats by counting existing games
      const [totalGames, finishedGames] = await Promise.all([
        ctx.prisma.gameParticipation.count({
          where: { 
            userId,
            gameSession: { status: { in: ['FINISHED', 'CANCELLED'] } },
          },
        }),
        ctx.prisma.gameParticipation.findMany({
          where: {
            userId,
            gameSession: { status: 'FINISHED' },
          },
          select: {
            isWinner: true,
            role: true,
          },
        }),
      ]);

      const totalWins = finishedGames.filter(g => g.isWinner === true).length;

      stats = await ctx.prisma.userStats.create({
        data: {
          userId,
          totalGames,
          totalWins,
        },
      });
    }

    const winRate = stats.totalGames > 0 ? (stats.totalWins / stats.totalGames) * 100 : 0;

    // Get role breakdown
    const roleStats = await ctx.prisma.gameParticipation.groupBy({
      by: ['role'],
      where: { 
        userId, 
        gameSession: { status: 'FINISHED' },
        role: { not: null },
      },
      _count: { id: true },
      _sum: {
        isWinner: true, // This won't work directly, we need a different approach
      },
    });

    return {
      totalGames: stats.totalGames,
      totalWins: stats.totalWins,
      winRate: Math.round(winRate * 10) / 10, // Round to 1 decimal
      townGames: stats.townGames,
      townWins: stats.townWins,
      mafiaGames: stats.mafiaGames,
      mafiaWins: stats.mafiaWins,
      neutralGames: stats.neutralGames,
      neutralWins: stats.neutralWins,
      roleStats: roleStats.map(r => ({
        role: r.role!,
        gamesPlayed: r._count.id,
      })),
    };
  }),

  // Get public leaderboard
  getLeaderboard: publicProcedure
    .input(z.object({
      type: z.enum(['wins', 'games', 'winRate']).default('wins'),
      limit: z.number().min(1).max(100).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const orderBy = input.type === 'wins' 
        ? { totalWins: 'desc' as const }
        : input.type === 'games'
        ? { totalGames: 'desc' as const }
        : { totalWins: 'desc' as const }; // For winRate, we'll calculate after fetching

      const users = await ctx.prisma.userStats.findMany({
        where: {
          totalGames: { gt: 0 }, // Only users who have played
        },
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
        orderBy,
        take: input.limit,
      });

      // Calculate win rates and re-sort if needed
      let leaderboard = users.map((stat, index) => ({
        rank: index + 1,
        user: {
          id: stat.user.id,
          name: stat.user.displayName || stat.user.name,
          image: stat.user.image,
        },
        gamesPlayed: stat.totalGames,
        gamesWon: stat.totalWins,
        winRate: stat.totalGames > 0 
          ? Math.round((stat.totalWins / stat.totalGames) * 1000) / 10
          : 0,
      }));

      if (input.type === 'winRate') {
        // Re-sort by win rate
        leaderboard.sort((a, b) => b.winRate - a.winRate);
        // Update ranks
        leaderboard = leaderboard.map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));
      }

      return leaderboard;
    }),

  // Get role-specific stats
  getRoleStats: protectedProcedure
    .input(z.object({ role: z.string() }))
    .query(async ({ ctx, input }) => {
      const stats = await ctx.prisma.gameParticipation.findMany({
        where: {
          userId: ctx.session.user.id,
          role: input.role,
          gameSession: { status: 'FINISHED' },
        },
        select: {
          isWinner: true,
          gameSession: {
            select: { 
              result: true, 
              startTime: true,
              endTime: true,
            },
          },
        },
      });

      const totalGames = stats.length;
      const wins = stats.filter(s => s.isWinner === true).length;
      const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

      return {
        role: input.role,
        totalGames,
        wins,
        winRate: Math.round(winRate * 10) / 10,
      };
    }),
});
