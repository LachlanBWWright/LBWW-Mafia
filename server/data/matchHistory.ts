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
