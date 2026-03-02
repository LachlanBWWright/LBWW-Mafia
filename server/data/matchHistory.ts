import { db } from "./sharedDb.js";
import { matches, matchParticipants } from "./schema.js";

export type MatchHistoryEvent = {
  time: number;
  type: "system" | "chat" | "whisper" | "action";
  actor?: string;
  target?: string;
  content: string;
};

export type MatchHistoryParticipant = {
  userId?: string | null;
  username: string;
  role: string;
  won: boolean;
};

export type MatchHistoryInput = {
  roomName: string;
  startedAt: Date;
  endedAt: Date;
  winningFaction: string;
  winningRoles: string[];
  participants: MatchHistoryParticipant[];
  conversationHistory: MatchHistoryEvent[];
  actionHistory: MatchHistoryEvent[];
};

export async function persistMatchHistory(input: MatchHistoryInput) {
  const insertedMatches = await db
    .insert(matches)
    .values({
      roomName: input.roomName,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      winningFaction: input.winningFaction,
      winningRoles: JSON.stringify(input.winningRoles),
      playerCount: input.participants.length,
      conversationHistory: JSON.stringify(input.conversationHistory),
      actionHistory: JSON.stringify(input.actionHistory),
    })
    .returning({ id: matches.id });

  const insertedMatch = insertedMatches[0];
  if (!insertedMatch) {
    console.error("Match history insert did not return an ID", {
      roomName: input.roomName,
      endedAt: input.endedAt.toISOString(),
    });
    return;
  }

  if (input.participants.length > 0) {
    await db.insert(matchParticipants).values(
      input.participants.map((participant) => ({
        matchId: insertedMatch.id,
        userId: participant.userId ?? null,
        username: participant.username,
        role: participant.role,
        won: participant.won,
      })),
    );
  }
}
