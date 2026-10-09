import { summarizePlayerStats } from "@mernmafia/shared/game/playerStats";
import { and, desc, eq, like, ne, or } from "drizzle-orm";
import {
  matchParticipants,
  matches,
  userRoles,
  users,
} from "@mernmafia/db/schema";
import type { RouterServices } from "@mernmafia/shared/trpc/appRouter";
import { db } from "~/server/db";

export const searchUsers: RouterServices["searchUsers"] = async ({
  query,
  limit,
}) => {
  const normalizedQuery = query.trim();
  const whereClause = normalizedQuery
    ? or(
        like(users.name, `%${normalizedQuery}%`),
        like(users.email, `%${normalizedQuery}%`),
      )
    : undefined;
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isAdmin: users.isAdmin,
    })
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.emailVerified))
    .limit(limit);
};

export const setUserAdmin: RouterServices["setUserAdmin"] = async ({
  userId,
  isAdmin,
}) => {
  await db.update(users).set({ isAdmin }).where(eq(users.id, userId));
};

export const getProfile: RouterServices["getProfile"] = async (userId) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new Error("Account not found");
  const roles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  return {
    id: user.id,
    name: user.name,
    handle: user.handle,
    email: user.email,
    image: user.image,
    avatarPreset: user.avatarPreset,
    bio: user.bio,
    profileVisibility: user.profileVisibility,
    historyVisibility: user.historyVisibility,
    theme: user.theme,
    reducedMotion: user.reducedMotion,
    soundEnabled: user.soundEnabled,
    notificationsEnabled: user.notificationsEnabled,
    roles: roles.length
      ? roles.map((row) => row.role)
      : [user.isAdmin ? "administrator" : "player"],
  };
};

export const updateProfile: RouterServices["updateProfile"] = async (
  userId,
  input,
) => {
  if (input.handle) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.handle, input.handle), ne(users.id, userId)))
      .limit(1);
    if (taken) throw new Error("That handle is already taken");
  }
  await db.update(users).set(input).where(eq(users.id, userId));
  return getProfile(userId);
};

export const getStats: RouterServices["getStats"] = async (userId) => {
  const rows = await db
    .select({
      role: matchParticipants.role,
      won: matchParticipants.won,
      faction: matches.winningFaction,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
    .where(eq(matchParticipants.userId, userId))
    .orderBy(desc(matches.endedAt));
  return summarizePlayerStats(rows);
};
