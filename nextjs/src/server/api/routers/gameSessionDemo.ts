import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import type { GameSession, GameParticipation, User } from "@prisma/client";

type GameSessionWithParticipants = GameSession & {
  participants: (GameParticipation & { user: User })[];
};

type GameHistoryItem = Omit<GameSession, "participants"> & {
  userRole: string | null | undefined;
  userJoinedAt: Date;
  userLeftAt: Date | null | undefined;
  participants: (GameParticipation & { user: User })[];
};

const gameSessionCreateInput = z.object({
  maxPlayers: z.number().min(4).max(20).default(10),
  settings: z.record(z.string(), z.any()).optional(),
});

const gameSessionJoinInput = z.object({
  roomCode: z.string().min(1),
});

const DEMO_USER_ID = "user_123";

export const gameSessionDemoRouter = createTRPCRouter({
  // Create a new game session (demo version)
  createDemo: publicProcedure
    .input(gameSessionCreateInput)
    .mutation(async ({ ctx, input }): Promise<GameSessionWithParticipants> => {
      // Generate a unique room code
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const gameSession = await ctx.prisma.gameSession.create({
        data: {
          roomId,
          roomCode,
          maxPlayers: input.maxPlayers,
          ...(input.settings && { settings: input.settings }),
          participants: {
            create: {
              userId: DEMO_USER_ID,
              role: "HOST",
            },
          },
        },
        include: { participants: { include: { user: true } } },
      });

      return gameSession;
    }),

  // Join an existing game session (demo version)
  joinDemo: publicProcedure
    .input(gameSessionJoinInput)
    .mutation(
      async ({ ctx, input }): Promise<GameSessionWithParticipants | null> => {
        const gameSession = await ctx.prisma.gameSession.findUnique({
          where: { roomCode: input.roomCode },
          include: {
            participants: true,
          },
        });

        if (!gameSession) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Game session not found",
          });
        }

        if (gameSession.status !== "WAITING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Game has already started or finished",
          });
        }

        if (gameSession.participants.length >= gameSession.maxPlayers) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Game session is full",
          });
        }

        // Check if user is already in the session
        const existingParticipation =
          await ctx.prisma.gameParticipation.findUnique({
            where: {
              userId_gameSessionId: {
                userId: DEMO_USER_ID,
                gameSessionId: gameSession.id,
              },
            },
          });

        if (existingParticipation) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You are already in this game session",
          });
        }

        await ctx.prisma.gameParticipation.create({
          data: {
            userId: DEMO_USER_ID,
            gameSessionId: gameSession.id,
          },
        });

        // Return updated session
        return await ctx.prisma.gameSession.findUnique({
          where: { id: gameSession.id },
          include: { participants: { include: { user: true } } },
        });
      },
    ),

  // Get user's game history (demo version)
  getUserHistoryDemo: publicProcedure.query(
    async ({ ctx }): Promise<GameHistoryItem[]> => {
      const userSessions = await ctx.prisma.gameParticipation.findMany({
        where: {
          userId: DEMO_USER_ID,
        },
        include: {
          gameSession: {
            include: { participants: { include: { user: true } } },
          },
        },
        orderBy: {
          joinedAt: "desc",
        },
      });

      return userSessions.map(
        (participation): GameHistoryItem => ({
          ...participation.gameSession,
          userRole: participation.role,
          userJoinedAt: participation.joinedAt,
          userLeftAt: participation.leftAt,
        }),
      );
    },
  ),
});
