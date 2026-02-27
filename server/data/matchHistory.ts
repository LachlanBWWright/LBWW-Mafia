import { sharedDbClient } from "./sharedDb";

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
  const insertMatchResult = await sharedDbClient.execute({
    sql: `
      INSERT INTO nextjs_match
      (roomName, startedAt, endedAt, winningFaction, winningRoles, playerCount, conversationHistory, actionHistory)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      input.roomName,
      input.startedAt.getTime(),
      input.endedAt.getTime(),
      input.winningFaction,
      JSON.stringify(input.winningRoles),
      input.participants.length,
      JSON.stringify(input.conversationHistory),
      JSON.stringify(input.actionHistory),
    ],
  });

  const insertedMatchId = Number(insertMatchResult.lastInsertRowid ?? 0);
  if (!insertedMatchId) {
    console.error("Match history insert did not return an ID", {
      roomName: input.roomName,
      endedAt: input.endedAt.toISOString(),
    });
    return;
  }

  for (const participant of input.participants) {
    await sharedDbClient.execute({
      sql: `
        INSERT INTO nextjs_match_participant
        (matchId, userId, username, role, won)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [
        insertedMatchId,
        participant.userId ?? null,
        participant.username,
        participant.role,
        participant.won ? 1 : 0,
      ],
    });
  }
}
