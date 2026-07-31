import { and, desc, eq, inArray, like, ne, or, sql } from "drizzle-orm";
import { db } from "~/server/db";
import {
  activeRoom,
  auditLogs,
  friendships,
  matchParticipants,
  matches,
  userBlocks,
  userRoles,
  users,
} from "@mernmafia/db/schema";
import type {
  MatchParticipantSummary,
  PersistMatchInput,
  RecentMatchSummary,
  RouterServices,
  UserSummary,
} from "@mernmafia/shared/trpc/appRouter";
import { deserializeEventHistory, deserializeStringArray } from "@mernmafia/shared/trpc/validators";
import { ok, err } from "neverthrow";

type MatchRow = {
  id: number;
  roomName: string;
  endedAt: Date;
  winningFaction: string;
  winningRoles: string;
  conversationHistory: string;
  actionHistory: string;
};

/**
 * Fetches participants for a list of match IDs.
 * Returns a map of match ID to its participants.
 *
 * @param matchIds - Array of match IDs to fetch participants for
 * @returns Map of match ID to participants
 */
const getParticipantsByMatchIds = async (
  matchIds: number[],
): Promise<Map<number, MatchParticipantSummary[]>> => {
  if (matchIds.length === 0) {
    return new Map();
  }

  const participantRows = await db
    .select({
      matchId: matchParticipants.matchId,
      username: matchParticipants.username,
      role: matchParticipants.role,
      won: matchParticipants.won,
    })
    .from(matchParticipants)
    .where(inArray(matchParticipants.matchId, matchIds));

  const participantMap = new Map<number, MatchParticipantSummary[]>();
  for (const participant of participantRows) {
    const current = participantMap.get(participant.matchId) ?? [];
    current.push({
      username: participant.username,
      role: participant.role,
      won: participant.won,
    });
    participantMap.set(participant.matchId, current);
  }

  return participantMap;
};

/**
 * Retrieves recent matches for a specific username.
 * Returns matches ordered by most recent first, deduplicated by match ID.
 *
 * @param options - Options object
 * @param options .username - Username to fetch matches for
 * @param options .limit - Maximum number of matches to return
 * @returns Recent matches with participant info
 */
const getRecentMatches = async ({
  username,
  limit,
}: {
  username: string;
  limit: number;
}): Promise<RecentMatchSummary[]> => {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) {
    return [];
  }

  const recentRows = await db
    .select({
      id: matches.id,
      roomName: matches.roomName,
      endedAt: matches.endedAt,
      winningFaction: matches.winningFaction,
      winningRoles: matches.winningRoles,
      conversationHistory: matches.conversationHistory,
      actionHistory: matches.actionHistory,
    })
    .from(matches)
    .innerJoin(matchParticipants, eq(matchParticipants.matchId, matches.id))
    .where(normalizedUsername.startsWith("user:")
      ? eq(matchParticipants.userId, normalizedUsername.slice(5))
      : eq(matchParticipants.username, normalizedUsername))
    .orderBy(desc(matches.endedAt))
    .limit(limit);

  const dedupedById = new Map<number, MatchRow>();
  for (const row of recentRows) {
    if (!dedupedById.has(row.id)) {
      dedupedById.set(row.id, {
        id: row.id,
        roomName: row.roomName,
        endedAt: row.endedAt,
        winningFaction: row.winningFaction,
        winningRoles: row.winningRoles,
        conversationHistory: row.conversationHistory,
        actionHistory: row.actionHistory,
      });
    }
  }

  const uniqueRows = Array.from(dedupedById.values()).slice(0, limit);
  const participantMap = await getParticipantsByMatchIds(uniqueRows.map((row) => row.id));

  return uniqueRows.map((row) => ({
    id: row.id,
    roomName: row.roomName,
    endedAt: row.endedAt,
    winningFaction: row.winningFaction,
    winningRoles: deserializeStringArray(row.winningRoles),
    participants: participantMap.get(row.id) ?? [],
    conversationCount: deserializeEventHistory(row.conversationHistory).length,
    actionCount: deserializeEventHistory(row.actionHistory).length,
  }));
};

/**
 * Searches users by name or email.
 * Returns matching users ordered by email verification status.
 *
 * @param options - Options object
 * @param options .query - Search query (name or email)
 * @param options .limit - Maximum number of results to return
 * @returns Matching users
 */
const searchUsers = async ({
  query,
  limit,
}: {
  query: string;
  limit: number;
}): Promise<UserSummary[]> => {
  const normalizedQuery = query.trim();
  const whereClause = normalizedQuery
    ? or(
        like(users.name, `%${normalizedQuery}%`),
        like(users.email, `%${normalizedQuery}%`),
      )
    : undefined;

  const rows = await db
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

  return rows;
};

/**
 * Updates a user's admin status.
 *
 * @param options - Options object
 * @param options .userId - User ID to update
 * @param options .isAdmin - New admin status
 */
const setUserAdmin = async ({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}) => {
  await db
    .update(users)
    .set({ isAdmin })
    .where(eq(users.id, userId));
};

const getProfile: RouterServices["getProfile"] = async (userId) => {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("Account not found");
  const roleRows = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
  return { id: user.id, name: user.name, handle: user.handle, email: user.email, image: user.image, bio: user.bio, profileVisibility: user.profileVisibility, historyVisibility: user.historyVisibility, theme: user.theme, reducedMotion: user.reducedMotion, soundEnabled: user.soundEnabled, notificationsEnabled: user.notificationsEnabled, roles: roleRows.length ? roleRows.map((row) => row.role) : [user.isAdmin ? "administrator" : "player"] };
};

const updateProfile: RouterServices["updateProfile"] = async (userId, input) => {
  if (input.handle) {
    const [taken] = await db.select({ id: users.id }).from(users).where(and(eq(users.handle, input.handle), ne(users.id, userId))).limit(1);
    if (taken) throw new Error("That handle is already taken");
  }
  await db.update(users).set(input).where(eq(users.id, userId));
  return getProfile(userId);
};

const getStats: RouterServices["getStats"] = async (userId) => {
  const rows = await db.select({ role: matchParticipants.role, won: matchParticipants.won, faction: matches.winningFaction, endedAt: matches.endedAt }).from(matchParticipants).innerJoin(matches, eq(matches.id, matchParticipants.matchId)).where(eq(matchParticipants.userId, userId)).orderBy(desc(matches.endedAt));
  const roleMap = new Map<string, { role: string; games: number; wins: number }>();
  const factionMap = new Map<string, { faction: string; games: number; wins: number }>();
  let currentStreak = 0; let bestWinStreak = 0; let running = 0; let firstLossSeen = false;
  rows.forEach((row) => {
    const role = roleMap.get(row.role) ?? { role: row.role, games: 0, wins: 0 }; role.games++; if (row.won) role.wins++; roleMap.set(row.role, role);
    const faction = factionMap.get(row.faction) ?? { faction: row.faction, games: 0, wins: 0 }; faction.games++; if (row.won) faction.wins++; factionMap.set(row.faction, faction);
    if (row.won) { running++; bestWinStreak = Math.max(bestWinStreak, running); if (!firstLossSeen) currentStreak++; } else { running = 0; firstLossSeen = true; }
  });
  const wins = rows.filter((row) => row.won).length;
  return { gamesPlayed: rows.length, wins, losses: rows.length - wins, winRate: rows.length ? wins / rows.length : 0, currentStreak, bestWinStreak, roles: [...roleMap.values()], factions: [...factionMap.values()] };
};

const relationshipFor = async (userId: string, otherId: string) => {
  const [blocked] = await db.select().from(userBlocks).where(and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, otherId))).limit(1);
  if (blocked) return "blocked";
  const [relation] = await db.select().from(friendships).where(or(and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, otherId)), and(eq(friendships.requesterId, otherId), eq(friendships.addresseeId, userId)))).limit(1);
  if (!relation) return "none";
  if (relation.status === "accepted") return "friend";
  return relation.requesterId === userId ? "outgoing" : "incoming";
};

const searchCommunity: RouterServices["searchCommunity"] = async (userId, query) => {
  const filter = query ? or(like(users.name, `%${query}%`), like(users.handle, `%${query}%`)) : undefined;
  const rows = await db.select({ id: users.id, name: users.name, handle: users.handle, image: users.image }).from(users).where(filter ? and(ne(users.id, userId), filter) : ne(users.id, userId)).limit(25);
  return Promise.all(rows.map(async (row) => ({ ...row, relationship: await relationshipFor(userId, row.id) })));
};

const listFriends: RouterServices["listFriends"] = async (userId) => {
  const relations = await db.select().from(friendships).where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)));
  const ids = relations.map((row) => row.requesterId === userId ? row.addresseeId : row.requesterId);
  if (!ids.length) return [];
  const rows = await db.select({ id: users.id, name: users.name, handle: users.handle, image: users.image }).from(users).where(inArray(users.id, ids));
  return Promise.all(rows.map(async (row) => ({ ...row, relationship: await relationshipFor(userId, row.id) })));
};

const requestFriend: RouterServices["requestFriend"] = async (userId, addresseeId) => {
  if (userId === addresseeId) throw new Error("You cannot add yourself");
  await db.insert(friendships).values({ requesterId: userId, addresseeId }).onConflictDoNothing();
};
const removeFriend: RouterServices["removeFriend"] = async (userId, otherId) => { await db.delete(friendships).where(or(and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, otherId)), and(eq(friendships.requesterId, otherId), eq(friendships.addresseeId, userId)))); };
const respondFriend: RouterServices["respondFriend"] = async (userId, requesterId, accept) => { if (accept) await db.update(friendships).set({ status: "accepted", updatedAt: new Date() }).where(and(eq(friendships.requesterId, requesterId), eq(friendships.addresseeId, userId))); else await db.delete(friendships).where(and(eq(friendships.requesterId, requesterId), eq(friendships.addresseeId, userId))); };
const blockUser: RouterServices["blockUser"] = async (userId, blockedId) => { await removeFriend(userId, blockedId); await db.insert(userBlocks).values({ blockerId: userId, blockedId }).onConflictDoNothing(); };
const setUserRoles: RouterServices["setUserRoles"] = async (actorId, userId, roles) => {
  await db.transaction(async (tx) => {
    await tx.delete(userRoles).where(eq(userRoles.userId, userId));
    await tx.insert(userRoles).values(roles.map((role) => ({ userId, role })));
    await tx.update(users).set({ isAdmin: roles.includes("administrator") }).where(eq(users.id, userId));
    await tx.insert(auditLogs).values({ actorId, subjectId: userId, action: "roles.updated", metadata: JSON.stringify({ roles }) });
  });
};

/**
 * Persists a completed match and its participants to the database.
 * Returns the ID of the newly created match.
 *
 * @param input - Match data to persist
 * @returns>} Match ID of the persisted match
 * @throws If failed to insert match
 */
const persistMatch = async (input: PersistMatchInput): Promise<{ id: number }> => {
  const result = await (async () => {
    const inserted = await db
      .insert(matches)
      .values({
        roomName: input.roomName,
        startedAt: new Date(input.startedAt),
        endedAt: new Date(input.endedAt),
        winningFaction: input.winningFaction,
        winningRoles: JSON.stringify(input.winningRoles),
        playerCount: input.participants.length,
        conversationHistory: JSON.stringify(input.conversationHistory),
        actionHistory: JSON.stringify(input.actionHistory),
      })
      .returning({ id: matches.id });

    const matchId = inserted[0]?.id;
    if (!matchId) {
      return err(new Error("Failed to insert match: no record returned"));
    }

    if (input.participants.length > 0) {
      await db.insert(matchParticipants).values(
        input.participants.map((p) => ({
          matchId,
          userId: p.userId ?? null,
          username: p.username,
          role: p.role,
          won: p.won,
        })),
      );
    }

    return ok({ id: matchId });
  })();

  if (result.isErr()) {
    throw result.error;
  }

  return result.value;
};

/**
 * Returns the active PartyKit room ID, creating it if this is the first lobby request.
 * This is matchmaking state only; live game state remains inside PartyKit.
 *
 * @returns The current room ID clients should connect to
 */
const getCurrentRoom = async (): Promise<{ roomId: string }> => {
  const existingRows = await db
    .select({ roomId: activeRoom.roomId })
    .from(activeRoom)
    .where(eq(activeRoom.id, 1))
    .limit(1);

  const existing = existingRows[0];
  if (existing) {
    return { roomId: existing.roomId };
  }

  const roomId = crypto.randomUUID();
  await db
    .insert(activeRoom)
    .values({ id: 1, roomId })
    .onConflictDoNothing();

  const rows = await db
    .select({ roomId: activeRoom.roomId })
    .from(activeRoom)
    .where(eq(activeRoom.id, 1))
    .limit(1);

  return { roomId: rows[0]?.roomId ?? roomId };
};

/**
 * Rotates the active game room ID.
 * Generates a new random UUID and updates the singleton active room record.
 *
 * @returns>} The new active room ID
 */
const rotateActiveRoom = async (): Promise<{ roomId: string }> => {
  const roomId = crypto.randomUUID();
  await db
    .insert(activeRoom)
    .values({ id: 1, roomId })
    .onConflictDoUpdate({
      target: activeRoom.id,
      set: { roomId, updatedAt: sql`now()` },
    });
  return { roomId };
};

export const trpcServices: RouterServices = {
  getRecentMatches,
  searchUsers,
  setUserAdmin,
  getProfile,
  updateProfile,
  getStats,
  searchCommunity,
  listFriends,
  requestFriend,
  respondFriend,
  removeFriend,
  blockUser,
  setUserRoles,
  persistMatch,
  getCurrentRoom,
  rotateActiveRoom,
};
