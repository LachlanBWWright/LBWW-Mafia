import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { err, ok } from "neverthrow";
import type { MatchHistoryEvent } from "./validators";
import { MatchHistoryEventSchema } from "./validators";

export type SessionUser = {
  id: string;
  name?: string | null;
  isAdmin: boolean;
};

export type MatchParticipantSummary = {
  username: string;
  role: string;
  won: boolean;
};

export type RecentMatchSummary = {
  id: number;
  roomName: string;
  endedAt: Date;
  winningFaction: string;
  winningRoles: string[];
  participants: MatchParticipantSummary[];
  conversationCount: number;
  actionCount: number;
};

export type UserSummary = {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
};

export type MatchHistoryParticipant = {
  userId?: string | null;
  username: string;
  role: string;
  won: boolean;
};

export type PersistMatchInput = {
  roomName: string;
  startedAt: string;
  endedAt: string;
  winningFaction: string;
  winningRoles: string[];
  participants: MatchHistoryParticipant[];
  conversationHistory: MatchHistoryEvent[];
  actionHistory: MatchHistoryEvent[];
};

export type RouterServices = {
  getRecentMatches: (input: {
    username: string;
    limit: number;
  }) => Promise<RecentMatchSummary[]>;
  searchUsers: (input: { query: string; limit: number }) => Promise<UserSummary[]>;
  setUserAdmin: (input: { userId: string; isAdmin: boolean }) => Promise<void>;
  persistMatch: (input: PersistMatchInput) => Promise<{ id: number }>;
  getCurrentRoom: () => Promise<{ roomId: string }>;
  rotateActiveRoom: () => Promise<{ roomId: string }>;
};

export type AppRouterContext = {
  sessionUser: SessionUser | null;
  isBackend: boolean;
};

const t = initTRPC.context<AppRouterContext>().create({
  transformer: superjson,
});

/**
 * Middleware that ensures a user is authenticated.
 * Returns an error result if no session user is present.
 */
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.sessionUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to use this endpoint.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      sessionUser: ctx.sessionUser,
    },
  });
});

/**
 * Middleware that ensures the request has the backend secret.
 * Returns an error result if the bearer token does not match the backend secret.
 */
const backendProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.isBackend) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Backend secret required.",
    });
  }
  return next();
});

/**
 * Middleware that ensures a user is authenticated and has admin privileges.
 * Returns an error result if the user is not an admin.
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.sessionUser.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required.",
    });
  }
  return next();
});

/**
 * Creates the tRPC application router with all RPC procedures.
 * Provides endpoints for match history, user search, and admin operations.
 *
 * @param services - Service layer implementations
 * @returns tRPC router with match, room, and admin procedure groups
 */
export function createAppRouter(services: RouterServices) {
  return t.router({
    match: t.router({
      persist: backendProcedure
        .input(
          z.object({
            roomName: z.string(),
            startedAt: z.string(),
            endedAt: z.string(),
            winningFaction: z.string(),
            winningRoles: z.array(z.string()),
            participants: z.array(
              z.object({
                userId: z.string().nullable().optional(),
                username: z.string(),
                role: z.string(),
                won: z.boolean(),
              }),
            ),
            conversationHistory: z.array(MatchHistoryEventSchema),
            actionHistory: z.array(MatchHistoryEventSchema),
          }),
        )
        .mutation(({ input }) =>
          services.persistMatch(input),
        ),
      recentByUsername: t.procedure
        .input(
          z.object({
            username: z.string().min(1),
            limit: z.number().int().min(1).max(50).default(10),
          }),
        )
        .query(({ input }) => services.getRecentMatches(input)),
      recentForCurrentUser: protectedProcedure
        .input(
          z.object({
            limit: z.number().int().min(1).max(50).default(10),
          }),
        )
        .query(async ({ ctx, input }) => {
          const username = ctx.sessionUser.name?.trim();
          const usernameResult = username
            ? ok(username)
            : err(new Error("No username available"));
          
          if (usernameResult.isErr()) {
            throw new TRPCError({ code: "BAD_REQUEST", message: usernameResult.error.message });
          }
          
          return services.getRecentMatches({ username: usernameResult.value, limit: input.limit });
        }),
    }),
    room: t.router({
      current: t.procedure
        .query(() => services.getCurrentRoom()),
      rotate: backendProcedure
        .mutation(() => services.rotateActiveRoom()),
    }),
    admin: t.router({
      searchUsers: adminProcedure
        .input(
          z.object({
            query: z.string().max(255).default(""),
            limit: z.number().int().min(1).max(100).default(25),
          }),
        )
        .query(({ input }) => services.searchUsers(input)),
      setUserAdmin: adminProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            isAdmin: z.boolean(),
          }),
        )
        .mutation(async ({ input }) => {
          await services.setUserAdmin(input);
          return { success: true };
        }),
    }),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
