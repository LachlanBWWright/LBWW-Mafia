import { matchParticipants, matches } from "../../db/schema.js";
import { sharedDb } from "./sharedDb.js";

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
  const inserted = await sharedDb
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

  const matchId = inserted[0]?.id;
  if (!matchId) {
    return;
  }

  await sharedDb.insert(matchParticipants).values(
    input.participants.map((participant) => ({
      matchId,
      userId: participant.userId,
      username: participant.username,
      role: participant.role,
      won: participant.won,
    })),
  );
}
