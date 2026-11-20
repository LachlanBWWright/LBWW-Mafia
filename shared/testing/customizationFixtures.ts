import { dayMatch } from "./matchFixtures";
import { resolveGameRules } from "../game/gameRules";
import type { LobbyState } from "../game/lobbyState";

export const customizedMatch: LobbyState = {
  ...dayMatch,
  started: false,
  currentUserRole: undefined,
  canVote: false,
  action: {},
  players: dayMatch.players.map((player) => ({ ...player, role: undefined })),
  setup: {
    rules: resolveGameRules({
      rules: {
        timing: {
          daySeconds: 90,
          nightSeconds: 20,
          firstDaySeconds: 30,
          earlyEnd: true,
        },
        voting: { method: "plurality", allowRevote: true },
        reveal: { onDeath: "faction", rolePool: true },
        communication: { whispers: false, lastWords: true, messageLimit: 10 },
        presentation: { theme: "noir", announcementStyle: "concise" },
        bots: { fillEmptySeats: true },
      },
    }),
    voteVisibility: "hidden",
    rolePool: ["Doctor", "Mafia", "Field Medic"],
  },
};
