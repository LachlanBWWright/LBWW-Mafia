import { desc, eq, inArray, like, or } from "drizzle-orm";
import { db } from "~/server/db";
import {
  matchParticipants,
  matches,
  users,
} from "../../../../db/schema";
import type {
  MatchParticipantSummary,
  RecentMatchSummary,
  RouterServices,
  UserSummary,
} from "../../../../shared/trpc/appRouter";

type MatchRow = {
  id: number;
  roomName: string;
  endedAt: Date;
  winningFaction: string;
  winningRoles: string;
  conversationHistory: string;
  actionHistory: string;
};

const parseArray = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === "string");
    }
  } catch {
    // ignore malformed json
  }
  return [];
};

const parseCount = (value: string): number => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.length;
    }
  } catch {
    // ignore malformed json
  }
  return 0;
};

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

export const trpcServices: RouterServices = {
  getRecentMatches,
  searchUsers,
  setUserAdmin,
};
