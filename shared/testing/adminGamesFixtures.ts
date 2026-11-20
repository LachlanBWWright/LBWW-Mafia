import type { AdminGamePage } from "../admin/games";
export const adminGamesFixture: AdminGamePage = {
  checkedAt: "2026-11-07T00:00:00Z",
  nextOffset: 10,
  games: [
    {
      roomId: "game-night",
      name: "Game night",
      visibility: "link-only",
      state: {
        players: 8,
        capacity: 10,
        connections: 7,
        reservedSeats: 0,
        started: true,
        ended: false,
        closed: false,
        phase: "night",
        day: 2,
        roster: [
          { name: "Mira", connected: true, isBot: false, alive: true },
          { name: "Theo", connected: false, isBot: false, alive: false },
          { name: "Jules", connected: true, isBot: true, alive: true },
        ],
        historyPending: false,
        historyAttempts: 0,
      },
    },
    {
      roomId: "quick-join",
      name: "Quick join",
      visibility: "public",
      state: {
        players: 3,
        capacity: 10,
        connections: 3,
        reservedSeats: 1,
        started: false,
        ended: false,
        closed: false,
        phase: "idle",
        day: 0,
        historyPending: false,
        historyAttempts: 0,
      },
    },
    {
      roomId: "last-match",
      name: "Last match",
      visibility: "public",
      state: {
        players: 6,
        capacity: 10,
        connections: 0,
        reservedSeats: 0,
        started: true,
        ended: true,
        closed: false,
        phase: "day",
        day: 4,
        historyPending: true,
        historyAttempts: 3,
      },
    },
    {
      roomId: "offline-room",
      name: "Offline room",
      visibility: "link-only",
      state: null,
    },
  ],
};

export async function loadAdminGamesFixture(
  query: import("../admin/games").AdminGameQuery,
) {
  return {
    ...adminGamesFixture,
    games: query.roomId
      ? adminGamesFixture.games.filter((room) => room.roomId === query.roomId)
      : query.offset
        ? adminGamesFixture.games.slice(2)
        : adminGamesFixture.games,
    nextOffset: query.roomId || query.offset ? null : 10,
  };
}
export async function unavailableAdminGames(): Promise<never> {
  throw new Error("offline");
}
