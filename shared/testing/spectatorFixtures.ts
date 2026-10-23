import { nightMatch } from "./matchFixtures";
import { defaultVisitCapability } from "../game/playerActionRules";
import type { LobbyState } from "../game/lobbyState";
export const spectatorMatch: LobbyState = {
  ...nightMatch,
  playerName: "Spectator 1",
  participation: "spectator",
  spectatorCount: 2,
  currentUserRole: undefined,
  visitCapability: defaultVisitCapability,
  canTalk: true,
  canVote: false,
  action: {},
  players: nightMatch.players.map((player) => ({
    ...player,
    role: player.isAlive === false ? player.role : undefined,
  })),
  messages: [
    { id: 1, kind: "system", text: "Night 2 began." },
    {
      id: 2,
      kind: "spectator",
      sender: "Spectator 2",
      text: "Spectator 2: That vote was surprising.",
    },
  ],
};
export const eliminatedMatch: LobbyState = {
  ...spectatorMatch,
  playerName: "Mira",
  participation: "eliminated",
  currentUserRole: "Doctor",
  players: spectatorMatch.players.map((player) =>
    player.name === "Mira"
      ? { ...player, isAlive: false, role: "Doctor" }
      : player,
  ),
};
