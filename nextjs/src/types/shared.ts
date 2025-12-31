// Local copy of shared types to avoid monorepo import issues
// These should ideally be imported from the shared package

export enum Time {
  Day = "day",
  Night = "night",
  Between = "between",
  Locked = "locked",
}

export interface ClientToServerEvents {
  playerJoinRoom: (
    data: { playerUsername: string },
    cb?: (result: string | number) => void,
  ) => void;
  disconnect: () => void;
  messageSentByUser: (data: { message: string; isDay: boolean }) => void;
  handleVote: (data: { recipient: number | null; isDay: boolean }) => void;
  handleVisit: (data: { recipient: number | null; isDay: boolean }) => void;
  handleWhisper: (data: {
    recipient: number;
    message: string;
    isDay: boolean;
  }) => void;
}

export interface ServerToClientEvents {
  receiveMessage: (data: { message: string }) => void;
  "receive-new-player": (data: { player: { name: string } }) => void;
  "receive-player-list": (data: {
    playerList: { name: string; isAlive?: boolean; role?: string }[];
  }) => void;
  "receive-chat-message": (data: { message: string }) => void;
  "receive-whisper-message": (data: { message: string }) => void;
  "update-day-time": (data: {
    time: Time;
    dayNumber: number;
    timeLeft: number;
  }) => void;
  "assign-player-role": (data: {
    name: string;
    role: string;
    dayVisitSelf: boolean;
    dayVisitOthers: boolean;
    dayVisitFaction: boolean;
    nightVisitSelf: boolean;
    nightVisitOthers: boolean;
    nightVisitFaction: boolean;
    nightVote: boolean;
  }) => void;
  "update-player-role": (data: { name: string }) => void;
  "update-faction-role": (data: { name: string }) => void;
  "update-player-visit": () => void;
  blockMessages: () => void;
  "disable-voting": () => void;
  "remove-player": (data: { player: { name: string } }) => void;
}

export interface MessageToClient {
  name: string;
  data?: Record<string, unknown>;
}

export interface PlayerJoinRoomMessage {
  playerUsername: string;
}

export interface MessageSentByUserMessage {
  message: string;
  isDay: boolean;
}

export interface HandleVoteMessage {
  recipient: number | null;
  isDay: boolean;
}

export interface HandleVisitMessage {
  recipient: number | null;
  isDay: boolean;
}

export interface HandleWhisperMessage {
  recipient: number;
  message: string;
  isDay: boolean;
}
