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

export type LobbyState = {
  joinStatus: string;
  playerName: string;
  joining: boolean;
  players: PlayerList[];
  messages: { id: number; text: string }[];
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
  | { type: "message"; text: string }
  | { type: "add"; player: PlayerList }
  | { type: "remove"; name: string }
  | { type: "role"; player: { name: string; role?: string }; dead?: boolean }
  | { type: "assign"; player: PlayerReturned }
  | { type: "snapshot"; value: GameSnapshot }
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
    case "patch":
      return { ...state, ...action.value };
    case "message":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: (state.messages.at(-1)?.id ?? 0) + 1, text: action.text },
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
      const updated = {
        ...state,
        ...snapshot,
        joining: false,
        joinStatus: "",
        currentUserRole: role?.role,
        visitCapability: role ?? defaultVisitCapability,
      };
      return role ? assign(updated, role) : updated;
    }
    case "tick":
      return { ...state, timeLeft: Math.max(0, state.timeLeft - 1) };
  }
}
