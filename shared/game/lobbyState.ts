import type {
  ActionSelection,
  LobbyMessage,
  MatchExperience,
} from "./matchExperience";
import {
  DayTime,
  type GameSnapshot,
  type PlayerList,
  type PlayerReturned,
} from "../communication/events";
import {
  defaultVisitCapability,
  type VisitCapability,
} from "./playerActionRules";

export type LobbyState = MatchExperience & {
  matchId?: string;
  phaseVersion?: number;
  snapshotReceived: boolean;
  connected: boolean;
  recoveryNotice: string;
  action: ActionSelection;
  joinStatus: string;
  playerName: string;
  joining: boolean;
  players: PlayerList[];
  messages: LobbyMessage[];
  messageDraft: string;
  time: DayTime;
  dayNumber: number;
  timeLeft: number;
  canTalk: boolean;
  canVote: boolean;
  visitCapability: VisitCapability;
  currentUserRole?: string;
};
export const initialLobbyState: LobbyState = {
  connected: false,
  snapshotReceived: false,
  recoveryNotice: "",
  action: {},
  joinStatus: "",
  playerName: "",
  joining: false,
  players: [],
  messages: [],
  messageDraft: "",
  time: DayTime.Day,
  dayNumber: 0,
  timeLeft: 0,
  canTalk: true,
  canVote: true,
  visitCapability: defaultVisitCapability,
};
export type LobbyAction =
  | { type: "patch"; value: Partial<LobbyState> }
  | {
      type: "phase";
      value: Pick<
        GameSnapshot,
        "time" | "dayNumber" | "timeLeft" | "phaseVersion"
      >;
    }
  | { type: "feedback"; feedback: string; outcome: ActionSelection["outcome"] }
  | {
      type: "message";
      text: string;
      kind?: LobbyMessage["kind"];
      sender?: string;
    }
  | { type: "add"; player: PlayerList }
  | { type: "remove"; name: string }
  | { type: "role"; player: { name: string; role?: string }; dead?: boolean }
  | { type: "assign"; player: PlayerReturned }
  | { type: "snapshot"; value: GameSnapshot }
  | { type: "connection"; connected: boolean }
  | { type: "tick" };
function assign(state: LobbyState, player: PlayerReturned): LobbyState {
  return {
    ...state,
    currentUserRole: player.role,
    visitCapability: player,
    players: state.players.map((entry) =>
      entry.name === player.name ? { ...entry, role: player.role } : entry,
    ),
  };
}
export function lobbyReducer(
  state: LobbyState,
  action: LobbyAction,
): LobbyState {
  switch (action.type) {
    case "phase": {
      const changed =
        action.value.time !== state.time ||
        action.value.dayNumber !== state.dayNumber ||
        (action.value.phaseVersion !== undefined &&
          action.value.phaseVersion !== state.phaseVersion);
      return { ...state, ...action.value, action: changed ? {} : state.action };
    }
    case "feedback":
      return {
        ...state,
        action: {
          ...state.action,
          feedback: action.feedback,
          outcome: action.outcome,
        },
      };
    case "patch":
      return { ...state, ...action.value };
    case "message":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: (state.messages.at(-1)?.id ?? 0) + 1,
            text: action.text,
            ...(action.kind
              ? {
                  kind: action.kind,
                  sender: action.sender,
                  isBot: state.players.find(
                    (player) => player.name === action.sender,
                  )?.isBot,
                }
              : {}),
          },
        ].slice(-500),
      };
    case "add":
      return state.players.some((entry) => entry.name === action.player.name)
        ? state
        : { ...state, players: [...state.players, action.player] };
    case "remove":
      return {
        ...state,
        players: state.players.filter((entry) => entry.name !== action.name),
      };
    case "role":
      return {
        ...state,
        players: state.players.map((entry) =>
          entry.name === action.player.name
            ? {
                ...entry,
                role: action.player.role ?? entry.role,
                ...(action.dead ? { isAlive: false } : {}),
              }
            : entry,
        ),
      };
    case "assign":
      return assign(state, action.player);
    case "snapshot": {
      const { role, ...snapshot } = action.value;
      const newMatch = Boolean(
        state.matchId && snapshot.matchId && state.matchId !== snapshot.matchId,
      );
      const newPhase =
        newMatch ||
        snapshot.time !== state.time ||
        snapshot.dayNumber !== state.dayNumber ||
        (snapshot.phaseVersion !== undefined &&
          state.phaseVersion !== undefined &&
          snapshot.phaseVersion !== state.phaseVersion);
      const base = newMatch
        ? { ...initialLobbyState, connected: state.connected }
        : state;
      const returning = Boolean(
        state.snapshotReceived && state.playerName && !state.connected,
      );
      const deaths = snapshot.players.filter(
        (player) =>
          player.isAlive === false &&
          base.players.find((prior) => prior.name === player.name)?.isAlive !==
            false,
      );
      const missed =
        snapshot.timeline
          ?.filter((entry) => entry.id > (base.timeline?.at(-1)?.id ?? 0))
          .map((entry) => entry.text)
          .slice(-3) ?? [];
      const recoveryNotice = returning
        ? `Reconnected. ${missed.join(" ") || (deaths.length ? `${deaths.map((player) => player.name).join(", ")} were eliminated.` : "No new public events.")} ${snapshot.time} ${snapshot.dayNumber}, ${snapshot.timeLeft}s remaining.`
        : base.recoveryNotice;
      const selectionChanged =
        snapshot.action !== undefined &&
        (snapshot.action.vote !== state.action.vote ||
          snapshot.action.visit !== state.action.visit);
      const selection = snapshot.action ?? (newPhase ? {} : state.action);
      // Messages can carry private outcomes before an unrelated roster/timer snapshot.
      // Retain that outcome until an authoritative new selection or phase replaces it.
      const confirmedAction =
        !newPhase && !selectionChanged && !selection.feedback
          ? { ...state.action, ...selection }
          : selection;
      const updated = {
        ...base,
        ...snapshot,
        connected: true,
        snapshotReceived: true,
        recoveryNotice,
        action: confirmedAction,
        joining: false,
        joinStatus: "",
        currentUserRole: role?.role,
        visitCapability: role ?? defaultVisitCapability,
      };
      return role ? assign(updated, role) : updated;
    }
    case "connection":
      return state.connected === action.connected
        ? state
        : { ...state, connected: action.connected };
    case "tick":
      return state.timeLeft <= 0
        ? state
        : { ...state, timeLeft: Math.max(0, state.timeLeft - 1) };
  }
}
