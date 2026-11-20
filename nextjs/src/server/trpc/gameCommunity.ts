import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import {
  campaigns,
  campaignMembers,
  campaignRounds,
  campaignVotes,
  replayAnnotations,
  replayNominations,
  matches,
  matchParticipants,
  users,
} from "@mernmafia/db/schema";
import type {
  CampaignSummary,
  GameCommunityServices,
} from "@mernmafia/shared/trpc/gameCommunity";
import {
  decodeGamePack,
  encodeGamePack,
} from "@mernmafia/shared/game/gameCustomization";
import { deserializeEventHistory } from "@mernmafia/shared/trpc/validators";
import { db } from "~/server/db";
import { canInteractWithUser } from "./services/presence";
type Database = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;
const unavailable = () =>
  new TRPCError({
    code: "NOT_FOUND",
    message: "This game community is unavailable.",
  });
const invalid = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });
async function campaign(
  tx: Database,
  userId: string,
  id: string,
  hostOnly = false,
  lock = true,
) {
  const query = tx.select().from(campaigns).where(eq(campaigns.id, id));
  const [row] = await (lock ? query.for("update") : query);
  if (!row) throw unavailable();
  const [member] = await tx
    .select()
    .from(campaignMembers)
    .where(
      and(
        eq(campaignMembers.campaignId, id),
        eq(campaignMembers.userId, userId),
      ),
    );
  if (!member || (hostOnly && row.hostId !== userId && row.ownerId !== userId))
    throw unavailable();
  return row;
}
async function summary(
  tx: Database,
  userId: string,
  id: string,
): Promise<CampaignSummary> {
  // Read-only summaries must not lock multiple groups in membership order.
  const row = await campaign(tx, userId, id, false, false);
  const members = await tx
    .select({ userId: campaignMembers.userId, name: users.name })
    .from(campaignMembers)
    .innerJoin(users, eq(users.id, campaignMembers.userId))
    .where(eq(campaignMembers.campaignId, id))
    .orderBy(asc(campaignMembers.joinedAt), asc(campaignMembers.userId));
  const rounds = await tx
    .select({ matchId: campaignRounds.matchId })
    .from(campaignRounds)
    .where(eq(campaignRounds.campaignId, id))
    .orderBy(asc(campaignRounds.matchId));
  const votes = await tx
    .select({ userId: campaignVotes.userId, packCode: campaignVotes.packCode })
    .from(campaignVotes)
    .where(eq(campaignVotes.campaignId, id));
  const scores = rounds.length
    ? await tx
        .select({
          userId: matchParticipants.userId,
          won: matchParticipants.won,
          winningFaction: matches.winningFaction,
        })
        .from(matchParticipants)
        .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
        .where(
          inArray(
            matches.id,
            rounds.map((r) => r.matchId),
          ),
        )
    : [];
  return {
    ...row,
    canManage: row.hostId === userId || row.ownerId === userId,
    members,
    rounds,
    votes,
    scoreboard: members.map((m) => {
      const played = scores.filter((s) => s.userId === m.userId);
      return {
        ...m,
        games: played.length,
        wins: played.filter((s) => s.won).length,
        draws: played.filter((s) => /^(draw|tie|none)$/i.test(s.winningFaction))
          .length,
      };
    }),
  };
}
async function completed(tx: Database, userId: string, matchId: number) {
  const [member] = await tx
    .select()
    .from(matchParticipants)
    .where(
      and(
        eq(matchParticipants.matchId, matchId),
        eq(matchParticipants.userId, userId),
      ),
    );
  const [match] = await tx
    .select()
    .from(matches)
    .where(and(eq(matches.id, matchId), lte(matches.endedAt, new Date())))
    .for("update");
  if (!member || !match || match.endedAt < match.startedAt) throw unavailable();
  return match;
}
async function publicEvent(
  tx: Database,
  userId: string,
  matchId: number,
  eventIndex: number,
) {
  const match = await completed(tx, userId, matchId);
  // Stable indices shared by all participants exclude private whispers entirely.
  const events = [
    ...deserializeEventHistory(match.actionHistory),
    ...deserializeEventHistory(match.conversationHistory),
  ]
    .filter((e) => e.type !== "whisper")
    .sort((a, b) => a.time - b.time);
  if (!events[eventIndex]) throw invalid("Choose a public replay event.");
}
export const gameCommunityServices: GameCommunityServices = {
  async list(userId) {
    const rows = await db
      .select({ id: campaignMembers.campaignId })
      .from(campaignMembers)
      .where(eq(campaignMembers.userId, userId))
      .limit(50);
    return db.transaction(async (tx) =>
      Promise.all(rows.map((r) => summary(tx, userId, r.id))),
    );
  },
  async create(userId, { name }) {
    return db.transaction(async (tx) => {
      // Serialize creations per account, bounding persistent groups.
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      const existing = await tx
        .select({ id: campaignMembers.campaignId })
        .from(campaignMembers)
        .where(eq(campaignMembers.userId, userId));
      if (existing.length >= 50) throw invalid("Persistent lobby limit reached.");
      const id = crypto.randomUUID();
      await tx.insert(campaigns).values({
        id,
        name,
        ownerId: userId,
        hostId: userId,
        shareCode: crypto.randomUUID().replaceAll("-", ""),
      });
      await tx.insert(campaignMembers).values({ campaignId: id, userId });
      return summary(tx, userId, id);
    });
  },
  async join(userId, { shareCode }) {
    return db.transaction(async (tx) => {
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      const [row] = await tx
        .select()
        .from(campaigns)
        .where(eq(campaigns.shareCode, shareCode))
        .for("update");
      if (!row) throw unavailable();
      const members = await tx
        .select()
        .from(campaignMembers)
        .where(eq(campaignMembers.campaignId, row.id));
      if (members.some((m) => m.userId === userId))
        return summary(tx, userId, row.id);
      if (members.length >= 15) throw invalid("Persistent lobby is full.");
      const groups = await tx
        .select()
        .from(campaignMembers)
        .where(eq(campaignMembers.userId, userId));
      if (groups.length >= 50) throw invalid("Persistent lobby limit reached.");
      for (const member of members)
        if (!(await canInteractWithUser(userId, member.userId, tx)))
          throw unavailable();
      await tx.insert(campaignMembers).values({ campaignId: row.id, userId });
      return summary(tx, userId, row.id);
    });
  },
  async detail(userId, { campaignId }) {
    return db.transaction((tx) => summary(tx, userId, campaignId));
  },
  async rotateHost(userId, { campaignId }) {
    return db.transaction(async (tx) => {
      const row = await campaign(tx, userId, campaignId, true);
      const members = await tx
        .select()
        .from(campaignMembers)
        .where(eq(campaignMembers.campaignId, campaignId))
        .orderBy(asc(campaignMembers.joinedAt), asc(campaignMembers.userId));
      const next =
        members[
          (members.findIndex((m) => m.userId === row.hostId) + 1) %
            members.length
        ]!;
      await tx
        .update(campaigns)
        .set({ hostId: next.userId })
        .where(eq(campaigns.id, campaignId));
      return summary(tx, userId, campaignId);
    });
  },
  async addRound(userId, { campaignId, matchId }) {
    return db.transaction(async (tx) => {
      await campaign(tx, userId, campaignId, true);
      await completed(tx, userId, matchId);
      const rounds = await tx
        .select()
        .from(campaignRounds)
        .where(eq(campaignRounds.campaignId, campaignId));
      if (rounds.some((round) => round.matchId === matchId))
        return summary(tx, userId, campaignId);
      if (rounds.length >= 100) throw invalid("Persistent lobby round limit reached.");
      await tx
        .insert(campaignRounds)
        .values({ campaignId, matchId })
        .onConflictDoNothing();
      return summary(tx, userId, campaignId);
    });
  },
  async voteSetup(userId, { campaignId, packCode }) {
    try {
      packCode = encodeGamePack(decodeGamePack(packCode));
    } catch {
      throw invalid("Choose a valid shared game pack.");
    }
    return db.transaction(async (tx) => {
      await campaign(tx, userId, campaignId);
      await tx
        .insert(campaignVotes)
        .values({ campaignId, userId, packCode })
        .onConflictDoUpdate({
          target: [campaignVotes.campaignId, campaignVotes.userId],
          set: { packCode },
        });
      return summary(tx, userId, campaignId);
    });
  },
  async discussion(userId, { matchId }) {
    return db.transaction(async (tx) => {
      await completed(tx, userId, matchId);
      const annotations = await tx
        .select({
          id: replayAnnotations.id,
          authorId: replayAnnotations.authorId,
          authorName: users.name,
          eventIndex: replayAnnotations.eventIndex,
          text: replayAnnotations.text,
        })
        .from(replayAnnotations)
        .innerJoin(users, eq(users.id, replayAnnotations.authorId))
        .where(eq(replayAnnotations.matchId, matchId))
        .orderBy(asc(replayAnnotations.eventIndex), asc(replayAnnotations.id));
      const nominations = await tx
        .select({
          userId: replayNominations.userId,
          nomineeId: replayNominations.nomineeId,
          eventIndex: replayNominations.eventIndex,
        })
        .from(replayNominations)
        .where(eq(replayNominations.matchId, matchId));
      const participants = await tx
        .select({
          userId: matchParticipants.userId,
          name: matchParticipants.username,
        })
        .from(matchParticipants)
        .where(eq(matchParticipants.matchId, matchId));
      return {
        viewerId: userId,
        participants: participants.filter(
          (p): p is { userId: string; name: string } => p.userId !== null,
        ),
        annotations,
        nominations,
      };
    });
  },
  async annotate(userId, { matchId, eventIndex, text }) {
    await db.transaction(async (tx) => {
      await publicEvent(tx, userId, matchId, eventIndex);
      const [total] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(replayAnnotations)
        .where(eq(replayAnnotations.matchId, matchId));
      if (total!.count >= 200) throw invalid("Discussion limit reached.");
      await tx.insert(replayAnnotations).values({
        id: crypto.randomUUID(),
        matchId,
        eventIndex,
        text,
        authorId: userId,
      });
    });
  },
  async deleteAnnotation(userId, { matchId, annotationId }) {
    await db.transaction(async (tx) => {
      await completed(tx, userId, matchId);
      const deleted = await tx
        .delete(replayAnnotations)
        .where(
          and(
            eq(replayAnnotations.id, annotationId),
            eq(replayAnnotations.matchId, matchId),
            eq(replayAnnotations.authorId, userId),
          ),
        )
        .returning({ id: replayAnnotations.id });
      if (!deleted.length) throw unavailable();
    });
  },
  async nominate(userId, { matchId, nomineeId, eventIndex }) {
    await db.transaction(async (tx) => {
      await publicEvent(tx, userId, matchId, eventIndex);
      const [nominee] = await tx
        .select()
        .from(matchParticipants)
        .where(
          and(
            eq(matchParticipants.matchId, matchId),
            eq(matchParticipants.userId, nomineeId),
          ),
        );
      if (!nominee) throw invalid("Choose a match participant.");
      await tx
        .insert(replayNominations)
        .values({ matchId, userId, nomineeId, eventIndex })
        .onConflictDoUpdate({
          target: [replayNominations.matchId, replayNominations.userId],
          set: { nomineeId, eventIndex },
        });
    });
  },
};
