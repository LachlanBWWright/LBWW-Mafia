import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { matches, matchParticipants } from "@mernmafia/db/schema";
import { db } from "~/server/db";
import {
  deserializeEventHistory,
  deserializeStringArray,
} from "@mernmafia/shared/trpc/validators";
import {
  participantReplay,
  summarizeMatchBalance,
  type AnalysisMatch,
  type MatchAnalysisServices,
} from "@mernmafia/shared/trpc/matchAnalysis";

async function hydrate(
  rows: (typeof matches.$inferSelect)[],
): Promise<AnalysisMatch[]> {
  if (!rows.length) return [];
  const participants = await db
    .select()
    .from(matchParticipants)
    .where(
      inArray(
        matchParticipants.matchId,
        rows.map((row) => row.id),
      ),
    );
  return rows.map((row) => ({
    id: row.id,
    roomName: row.roomName,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    winningFaction: row.winningFaction,
    winningRoles: deserializeStringArray(row.winningRoles),
    participants: participants
      .filter((p) => p.matchId === row.id)
      .map(({ username, role, won, userId }) => ({
        username,
        role,
        won,
        userId,
      })),
    events: [
      ...deserializeEventHistory(row.actionHistory),
      ...deserializeEventHistory(row.conversationHistory),
    ],
  }));
}
export const matchAnalysisServices: MatchAnalysisServices = {
  async getReplay({ matchId, viewerId, isAdmin }) {
    // Do not load private histories until membership has been established.
    if (!isAdmin) {
      const [member] = await db
        .select({ id: matchParticipants.id })
        .from(matchParticipants)
        .where(
          and(
            eq(matchParticipants.matchId, matchId),
            eq(matchParticipants.userId, viewerId),
          ),
        )
        .limit(1);
      if (!member)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Replay unavailable.",
        });
    }
    const rows = await db
      .select()
      .from(matches)
      .where(and(eq(matches.id, matchId), lte(matches.endedAt, new Date())))
      .limit(1);
    const [match] = await hydrate(rows);
    const replay = match && participantReplay(match, viewerId, isAdmin);
    if (!replay)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Replay unavailable.",
      });
    return replay;
  },
  async getBalance({ limit }) {
    const rows = await db
      .select()
      .from(matches)
      .where(lte(matches.endedAt, new Date()))
      .orderBy(desc(matches.endedAt))
      .limit(Math.min(500, Math.max(1, limit)));
    return summarizeMatchBalance(await hydrate(rows));
  },
};
