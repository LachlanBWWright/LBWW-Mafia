import { DayTime } from "../communication/events";
import { initialLobbyState, type LobbyState } from "../game/lobbyState";
export const nightMatch: LobbyState = {
  ...initialLobbyState,
  playerName: "Mira",
  connected: true,
  started: true,
  time: DayTime.Night,
  dayNumber: 2,
  timeLeft: 18,
  currentUserRole: "Doctor",
  visitCapability: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: true,
    nightVisitFaction: true,
  },
  action: {
    visit: "Theo",
    outcome: "submitted",
    feedback: "Night action selected: Theo. You can change it until dawn.",
  },
  players: [
    { name: "Mira", role: "Doctor", isAlive: true, connected: true },
    { name: "Theo", isAlive: true, connected: true },
    { name: "Nadia", isAlive: true, connected: false, isBot: true },
    { name: "Sam", isAlive: false, role: "Mafia", connected: true },
  ],
  messages: [
    { id: 1, text: "Night 2 began.", kind: "system" },
    {
      id: 2,
      text: "Theo: I think Nadia's claim needs checking.",
      kind: "chat",
      sender: "Theo",
    },
    {
      id: 3,
      text: "Theo: Who did you watch last night?",
      kind: "chat",
      sender: "Theo",
    },
    { id: 4, text: "Whisper from Theo: Can you protect me?", kind: "whisper" },
    {
      id: 5,
      text: "Nadia: Let's compare our votes.",
      kind: "chat",
      sender: "Nadia",
      isBot: true,
    },
  ],
};
export const dayMatch: LobbyState = {
  ...nightMatch,
  time: DayTime.Day,
  canVote: true,
  voteVisibility: "public",
  action: {
    vote: "Theo",
    feedback: "Vote submitted for Theo.",
    outcome: "submitted",
  },
  players: nightMatch.players.map((player) => ({
    ...player,
    votesReceived: player.name === "Theo" ? 2 : 0,
    voteStatus:
      player.name === "Mira"
        ? "voted"
        : player.name === "Nadia"
          ? "abstained"
          : "pending",
    voteTarget: player.name === "Mira" ? "Theo" : undefined,
  })),
};
export const hiddenMatch: LobbyState = {
  ...dayMatch,
  voteVisibility: "hidden",
  players: dayMatch.players.map(
    ({
      votesReceived: _votes,
      voteStatus: _status,
      voteTarget: _target,
      ...player
    }) => player,
  ),
};
export const recapMatch: LobbyState = {
  ...dayMatch,
  ended: true,
  canTalk: false,
  canVote: false,
  readyPlayers: ["Theo"],
  recap: {
    winner: "Town",
    reason: "The surviving non-neutral players all belong to Town.",
    players: [
      { name: "Mira", role: "Doctor", won: true },
      { name: "Theo", role: "Investigator", won: true },
      { name: "Nadia", role: "Mafia", won: false },
      { name: "Sam", role: "Mafia", won: false },
    ],
    timeline: [
      { id: 1, day: 1, phase: DayTime.Day, text: "Day 1 began." },
      { id: 2, day: 2, phase: DayTime.Night, text: "Sam died (Mafia)." },
      {
        id: 3,
        day: 3,
        phase: DayTime.Day,
        text: "Nadia was voted out (Mafia).",
      },
    ],
  },
};
export const reconnectMatch: LobbyState = {
  ...nightMatch,
  connected: false,
  recoveryNotice: "Reconnected. Sam died (Mafia). Night 2, 18s remaining.",
};
export const fixtureLobbyActions = {
  joinGame: () => undefined,
  sendMessage: () => undefined,
  voteForPlayer: () => undefined,
  visitPlayer: () => undefined,
  whisperToPlayer: () => undefined,
  setMessageDraft: () => undefined,
  cancelVisit: () => undefined,
  readyForRematch: () => undefined,
  dismissRecovery: () => undefined,
  advancePractice: () => undefined,
};
