import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

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

export type RouterServices = {
  getRecentMatches: (input: {
    username: string;
    limit: number;
  }) => Promise<RecentMatchSummary[]>;
  searchUsers: (input: { query: string; limit: number }) => Promise<UserSummary[]>;
  setUserAdmin: (input: { userId: string; isAdmin: boolean }) => Promise<void>;
};

export type AppRouterContext = {
  sessionUser: SessionUser | null;
};

const t = initTRPC.context<AppRouterContext>().create({
  transformer: superjson,
});

const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.sessionUser) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      sessionUser: ctx.sessionUser,
    },
  });
});

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.sessionUser.isAdmin) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next();
});

export function createAppRouter(services: RouterServices) {
  return t.router({
    match: t.router({
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
        .query(({ ctx, input }) => {
          const username = ctx.sessionUser.name?.trim();
          if (!username) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "No username available" });
          }
          return services.getRecentMatches({ username, limit: input.limit });
        }),
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
