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

/**
 * Triggers rotation of the active room by making a tRPC request to the NextJS backend.
 * This is used to advance the game state and manage room transitions.
 * 
 * @returns {Promise<void>} Resolves when the request completes
 * @throws {Error} If the tRPC request fails (logged to console error)
 */
export async function rotateActiveRoom(): Promise<void> {
  const url = process.env.NEXTJS_URL;
  const secret = process.env.BACKEND_SECRET;

  if (!url || !secret) {
    console.warn("rotateActiveRoom: NEXTJS_URL or BACKEND_SECRET not set, skipping");
    return;
  }

  const res = await fetch(`${url}/api/trpc/room.rotate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ "0": { json: null } }),
  });

  if (!res.ok) {
    console.error(`rotateActiveRoom: tRPC request failed with status ${res.status}`);
  }
}

/**
 * Persists a completed match's history to the database via the NextJS backend.
 * Converts date objects to ISO strings and sends all match metadata to the match.persist tRPC endpoint.
 * 
 * @param {MatchHistoryInput} input - The match history data to persist
 * @param {string} input.roomName - The name of the room where the match occurred
 * @param {Date} input.startedAt - When the match started
 * @param {Date} input.endedAt - When the match ended
 * @param {string} input.winningFaction - Name of the faction that won
 * @param {string[]} input.winningRoles - List of role names that won
 * @param {MatchHistoryParticipant[]} input.participants - List of all players and their results
 * @param {MatchHistoryEvent[]} input.conversationHistory - Chat messages during the match
 * @param {MatchHistoryEvent[]} input.actionHistory - Actions taken during the match
 * @returns {Promise<void>} Resolves when the request completes
 */
export async function persistMatchHistory(input: MatchHistoryInput) {
  const url = process.env.NEXTJS_URL;
  const secret = process.env.BACKEND_SECRET;

  if (!url || !secret) {
    console.warn(
      "persistMatchHistory: NEXTJS_URL or BACKEND_SECRET not set, skipping",
    );
    return;
  }

  const body = {
    "0": {
      json: {
        roomName: input.roomName,
        startedAt: input.startedAt.toISOString(),
        endedAt: input.endedAt.toISOString(),
        winningFaction: input.winningFaction,
        winningRoles: input.winningRoles,
        participants: input.participants,
        conversationHistory: input.conversationHistory,
        actionHistory: input.actionHistory,
      },
    },
  };

  const res = await fetch(`${url}/api/trpc/match.persist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(
      `persistMatchHistory: tRPC request failed with status ${res.status}`,
    );
  }
}
