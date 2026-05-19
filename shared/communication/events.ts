/**
 * Shared event type definitions for client-server communication.
 * These types are backend-agnostic and used by both Socket.IO and PartyKit.
 */
import { DayTime } from "../game/playerActionRules";
import type { GameMessage } from "./messages";
export { DayTime };

/** Numeric error codes returned when a room join request is rejected. */
export enum JoinRoomResultCode {
  GenericError = 1,
  CaptchaFailed = 2,
  RoomFull = 3,
}

/** Discriminated acknowledgement result for room join requests. */
export type JoinRoomResult =
  | {
      status: "joined";
      username: string;
    }
  | {
      status: "rejected";
      code: JoinRoomResultCode;
    };

/** Named end-game outcome kinds used instead of string sentinels. */
export enum GameOutcome {
  Draw = "draw",
  Faction = "faction",
}

/** Result emitted internally when a game ends. */
export type GameEndResult =
  | {
      outcome: GameOutcome.Draw;
    }
  | {
      outcome: GameOutcome.Faction;
      factionName: string;
    };

/** Named action kinds persisted into match history. */
export enum ActionKind {
  Vote = "vote",
  Whisper = "whisper",
  DayVisit = "day-visit",
  NightVisit = "night-visit",
}

/** Named PartyKit envelope kinds for the JSON socket protocol. */
export enum PartyKitMessageType {
  Event = "event",
  Callback = "callback",
}

/** Enum of all server → client socket event names. */
export enum ServerEvent {
  ReceiveMessage = "receiveMessage",
  BlockMessages = "blockMessages",
  ReceiveNewPlayer = "receive-new-player",
  RemovePlayer = "remove-player",
  ReceivePlayerList = "receive-player-list",
  ReceiveChatMessage = "receive-chat-message",
  ReceiveWhisperMessage = "receive-whisper-message",
  UpdateDayTime = "update-day-time",
  DisableVoting = "disable-voting",
  UpdatePlayerRole = "update-player-role",
  AssignPlayerRole = "assign-player-role",
  UpdateFactionRole = "update-faction-role",
  ReceiveRole = "receive-role",
  UpdatePlayerVisit = "update-player-visit",
}

/** Enum of all client → server socket event names. */
export enum ClientEvent {
  PlayerJoinRoom = "playerJoinRoom",
  Disconnect = "disconnect",
  MessageSentByUser = "messageSentByUser",
  HandleVote = "handleVote",
  HandleVisit = "handleVisit",
  HandleWhisper = "handleWhisper",
}

export type PlayerList = {
  name: string;
  isAlive?: boolean;
  role?: string;
};

export type PlayerReturned = {
  name: string;
  role: string;
  dayVisitSelf: boolean;
  dayVisitOthers: boolean;
  dayVisitFaction: boolean;
  nightVisitSelf: boolean;
  nightVisitOthers: boolean;
  nightVisitFaction: boolean;
  nightVote: boolean;
};

export type ClientToServerEvents = {
  playerJoinRoom: (
    captchaToken: string,
    cb: (result: JoinRoomResult) => void,
  ) => Promise<void>;
  disconnect: () => void;
  messageSentByUser: (message: string, phase: DayTime) => void;
  handleVote: (recipient: number, phase: DayTime) => void;
  handleVisit: (recipient: number | null, phase: DayTime) => void;
  handleWhisper: (recipient: number, message: string, phase: DayTime) => void;
};

export type ServerToClientEvents = {
  receiveMessage: (message: GameMessage) => void;
  blockMessages: () => void;
  "receive-new-player": (player: { name: string }) => void;
  "remove-player": (player: { name: string }) => void;
  "receive-player-list": (playerList: PlayerList[]) => void;
  "receive-chat-message": (message: string) => void;
  "receive-whisper-message": (message: string) => void;
  "update-day-time": (data: {
    time: DayTime;
    dayNumber: number;
    timeLeft: number;
  }) => void;
  "disable-voting": () => void;
  "update-player-role": (data: { name: string; role?: string }) => void;
  "assign-player-role": (data: PlayerReturned) => void;
  "update-faction-role": (data: { name: string; role: string }) => void;
  "receive-role": (role: string) => void;
  "update-player-visit": () => void;
};

export type InterServerEvents = Record<string, never>;
