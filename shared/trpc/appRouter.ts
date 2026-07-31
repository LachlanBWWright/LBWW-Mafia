import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import type { MatchHistoryEvent } from "./validators";
import { MatchHistoryEventSchema } from "./validators";

export type SessionUser = {
  id: string;
  name?: string | null;
  isAdmin: boolean;
  roles?: string[];
};

export type AccountProfile = {
  id: string; name: string | null; handle: string | null; email: string;
  image: string | null; bio: string | null; profileVisibility: string;
  historyVisibility: string; theme: string; reducedMotion: boolean;
  soundEnabled: boolean; notificationsEnabled: boolean; roles: string[];
};

export type PlayerStats = {
  gamesPlayed: number; wins: number; losses: number; winRate: number;
  currentStreak: number; bestWinStreak: number;
  roles: { role: string; games: number; wins: number }[];
  factions: { faction: string; games: number; wins: number }[];
};

export type SocialUser = { id: string; name: string | null; handle: string | null; image: string | null; relationship: string };

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
  getProfile: (userId: string) => Promise<AccountProfile>;
  updateProfile: (userId: string, input: Omit<Partial<AccountProfile>, "id" | "email" | "roles">) => Promise<AccountProfile>;
  getStats: (userId: string) => Promise<PlayerStats>;
  searchCommunity: (userId: string, query: string) => Promise<SocialUser[]>;
  listFriends: (userId: string) => Promise<SocialUser[]>;
  requestFriend: (userId: string, addresseeId: string) => Promise<void>;
  respondFriend: (userId: string, requesterId: string, accept: boolean) => Promise<void>;
  removeFriend: (userId: string, otherId: string) => Promise<void>;
  blockUser: (userId: string, blockedId: string) => Promise<void>;
  setUserRoles: (actorId: string, userId: string, roles: string[]) => Promise<void>;
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
  if (!ctx.sessionUser.isAdmin && !ctx.sessionUser.roles?.includes("administrator")) {
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
        .query(({ ctx, input }) => services.getRecentMatches({ username: `user:${ctx.sessionUser.id}`, limit: input.limit })),
    }),
    account: t.router({
      profile: protectedProcedure.query(({ ctx }) => services.getProfile(ctx.sessionUser.id)),
      updateProfile: protectedProcedure.input(z.object({
        name: z.string().trim().min(2).max(255).optional(),
        handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/).optional(),
        image: z.string().url().max(255).nullable().optional(), bio: z.string().max(280).nullable().optional(),
        profileVisibility: z.enum(["public", "friends", "private"]).optional(),
        historyVisibility: z.enum(["public", "friends", "private"]).optional(),
        theme: z.enum(["dark", "light", "system"]).optional(), reducedMotion: z.boolean().optional(),
        soundEnabled: z.boolean().optional(), notificationsEnabled: z.boolean().optional(),
      })).mutation(({ ctx, input }) => services.updateProfile(ctx.sessionUser.id, input)),
      stats: protectedProcedure.query(({ ctx }) => services.getStats(ctx.sessionUser.id)),
    }),
    social: t.router({
      search: protectedProcedure.input(z.object({ query: z.string().trim().max(64) })).query(({ ctx, input }) => services.searchCommunity(ctx.sessionUser.id, input.query)),
      friends: protectedProcedure.query(({ ctx }) => services.listFriends(ctx.sessionUser.id)),
      request: protectedProcedure.input(z.object({ userId: z.string().min(1) })).mutation(async ({ ctx, input }) => { await services.requestFriend(ctx.sessionUser.id, input.userId); return { success: true }; }),
      respond: protectedProcedure.input(z.object({ userId: z.string().min(1), accept: z.boolean() })).mutation(async ({ ctx, input }) => { await services.respondFriend(ctx.sessionUser.id, input.userId, input.accept); return { success: true }; }),
      remove: protectedProcedure.input(z.object({ userId: z.string().min(1) })).mutation(async ({ ctx, input }) => { await services.removeFriend(ctx.sessionUser.id, input.userId); return { success: true }; }),
      block: protectedProcedure.input(z.object({ userId: z.string().min(1) })).mutation(async ({ ctx, input }) => { await services.blockUser(ctx.sessionUser.id, input.userId); return { success: true }; }),
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
      setUserRoles: adminProcedure.input(z.object({ userId: z.string().min(1), roles: z.array(z.enum(["player", "moderator", "administrator", "support"])).min(1) })).mutation(async ({ ctx, input }) => {
        await services.setUserRoles(ctx.sessionUser.id, input.userId, input.roles);
        return { success: true };
      }),
    }),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
