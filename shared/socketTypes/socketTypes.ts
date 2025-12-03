export type EventType<T> = {
  name: string;
  data: T;
};

export enum Time {
  Day = "day",
  Night = "night",
  Between = "between",
  Locked = "locked",
}

export type PlayerJoinRoomMessage = {
  name: "playerJoinRoom";
  data: {
    captchaToken: string;
  };
};
export type MessageSentByUserMessage = {
  name: "messageSentByUser";
  data: {
    message: string;
    isDay: boolean;
  };
};
export type HandleVoteMessage = {
  name: "handleVote";
  data: {
    recipient: number | null;
    isDay: boolean;
  };
};
export type HandleVisitMessage = {
  name: "handleVisit";
  data: {
    recipient: number | null;
    isDay: boolean;
  };
};
export type HandleWhisperMessage = {
  name: "handleWhisper";
  data: {
    recipient: number;
    message: string;
    isDay: boolean;
  };
};

export type MessageToServer =
  | PlayerJoinRoomMessage
  | MessageSentByUserMessage
  | HandleVoteMessage
  | HandleVisitMessage
  | HandleWhisperMessage;

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

type PlayerList = {
  name: string;
  isAlive: boolean | undefined;
  role: string;
};

type PlayerReturned = {
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

type SvrMsg = {
  name: keyof ServerToClientEvents;
};

export type ReceiveMessage = {
  name: "receiveMessage";
  data: {
    message: string;
  };
};
export type BlockMessages = {
  name: "blockMessages";
};
export type ReceiveNewPlayer = {
  name: "receive-new-player";
  data: {
    player: { name: string };
  };
};
export type RemovePlayer = {
  name: "remove-player";
  data: {
    player: { name: string };
  };
};
export type ReceivePlayerList = {
  name: "receive-player-list";
  data: {
    playerList: PlayerList[];
  };
};
export type ReceiveChatMessage = {
  name: "receive-chat-message";
  data: {
    message: string;
  };
};
export type ReceiveWhisperMessage = {
  name: "receive-whisper-message";
  data: {
    message: string;
  };
};
export type UpdateDayTime = {
  name: "update-day-time";
  data: {
    time: Time;
    dayNumber: number;
    timeLeft: number;
  };
};
export type DisableVoting = {
  name: "disable-voting";
};
export type UpdatePlayerRole = {
  name: "update-player-role";
  data: {
    name: string;
    role?: string;
  };
};
export type AssignPlayerRole = {
  name: "assign-player-role";
  data: PlayerReturned;
};
export type UpdateFactionRole = {
  name: "update-faction-role";
  data: {
    name: string;
    role: string;
  };
};
export type ReceiveRole = {
  name: "receive-role";
  data: {
    role: string;
  };
};
export type UpdatePlayerVisit = {
  name: "update-player-visit";
};

export type JoinRoomCallback = {
  name: "joinRoomCallback";
  data: {
    result: string | number;
  };
};

export type MessageToClient =
  | ReceiveMessage
  | BlockMessages
  | ReceiveNewPlayer
  | RemovePlayer
  | ReceivePlayerList
  | ReceiveChatMessage
  | ReceiveWhisperMessage
  | UpdateDayTime
  | DisableVoting
  | UpdatePlayerRole
  | AssignPlayerRole
  | UpdateFactionRole
  | ReceiveRole
  | UpdatePlayerVisit
  | JoinRoomCallback;

export type ServerToClientEvents = {
  //receive-message
  receiveMessage: (message: string) => void;
  blockMessages: () => void;
  "receive-new-player": (player: { name: string }) => void;
  "remove-player": (player: { name: string }) => void;
  "receive-player-list": (playerList: PlayerList[]) => void;
  "receive-chat-message": (message: string) => void;
  "receive-whisper-message": (message: string) => void;
  "update-day-time": (data: {
    time: Time;
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
