import { desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { db } from "~/server/db";
import {
  activeRoom,
  matchParticipants,
  matches,
  users,
} from "@mernmafia/db/schema";
import type {
  MatchParticipantSummary,
  PersistMatchInput,
  RecentMatchSummary,
  RouterServices,
  UserSummary,
} from "@mernmafia/shared/trpc/appRouter";
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
 * Parses a JSON string into an array of strings.
 * Returns empty array if parsing fails.
 *
 * @param value - JSON string to parse
 * @returns Parsed array of strings, or empty array
 */
const parseArray = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === "string");
    }
  } catch (error) {
    console.error("Failed to parse winningRoles JSON", error);
  }
  return [];
};

/**
 * Parses a JSON string into an array and returns its length.
 * Returns 0 if parsing fails.
 *
 * @param value - JSON string to parse
 * @returns Length of parsed array, or 0
 */
const parseCount = (value: string): number => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.length;
    }
  } catch (error) {
    console.error("Failed to parse history JSON", error);
  }
  return 0;
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
    .where(eq(matchParticipants.username, normalizedUsername))
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
    winningRoles: parseArray(row.winningRoles),
    participants: participantMap.get(row.id) ?? [],
    conversationCount: parseCount(row.conversationHistory),
    actionCount: parseCount(row.actionHistory),
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
  persistMatch,
  rotateActiveRoom,
};
