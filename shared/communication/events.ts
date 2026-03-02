/**
 * Shared event type definitions for client-server communication.
 * These types are backend-agnostic and used by both Socket.IO and PartyKit.
 */

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
  isAlive: boolean | undefined;
  role: string;
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
    cb: (result: string | number) => void,
  ) => Promise<void>;
  disconnect: () => void;
  messageSentByUser: (message: string, isDay: boolean) => void;
  handleVote: (recipient: number | null, isDay: boolean) => void;
  handleVisit: (recipient: number | null, isDay: boolean) => void;
  handleWhisper: (recipient: number, message: string, isDay: boolean) => void;
};

export type ServerToClientEvents = {
  receiveMessage: (message: string) => void;
  blockMessages: () => void;
  "receive-new-player": (player: { name: string }) => void;
  "remove-player": (player: { name: string }) => void;
  "receive-player-list": (playerList: PlayerList[]) => void;
  "receive-chat-message": (message: string) => void;
  "receive-whisper-message": (message: string) => void;
  "update-day-time": (data: {
    time: "Day" | "Night";
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
