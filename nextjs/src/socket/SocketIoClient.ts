import { AbstractSocketClient } from "./AbstractSocketClient";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "~/types/shared";
import type { Time } from "~/types/shared";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import {
  ReceiveMessageDataSchema,
  ReceiveChatMessageDataSchema,
  ReceiveWhisperMessageDataSchema,
  ReceivePlayerListDataSchema,
  ReceiveNewPlayerDataSchema,
  RemovePlayerDataSchema,
  AssignPlayerRoleDataSchema,
  UpdateFactionRoleDataSchema,
  UpdatePlayerRoleDataSchema,
  UpdateDayTimeDataSchema,
} from "./socketSchemas";

export class SocketIoClient extends AbstractSocketClient {
  private _socket: Socket<ServerToClientEvents, ClientToServerEvents>;

  constructor(url: string) {
    super();
    this._socket = io(url, {
      autoConnect: false,
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });
    this._setupListeners();
  }

  sendPlayerJoinRoom(
    captchaToken: string,
    cb: (result: string | number) => void,
  ): void {
    this._socket.emit("playerJoinRoom", { playerUsername: captchaToken }, cb);
  }

  sendDisconnect(): void {
    this._socket.emit("disconnect");
  }

  sendMessageSentByUser(message: string, isDay: boolean): void {
    this._socket.emit("messageSentByUser", { message, isDay });
  }

  sendHandleVote(recipient: number | null, isDay: boolean): void {
    this._socket.emit("handleVote", { recipient, isDay });
  }

  sendHandleVisit(recipient: number | null, isDay: boolean): void {
    this._socket.emit("handleVisit", { recipient, isDay });
  }

  sendHandleWhisper(recipient: number, message: string, isDay: boolean): void {
    this._socket.emit("handleWhisper", { recipient, message, isDay });
  }

  private _setupListeners() {
    // Use zod-based parsing for each event to avoid duck-typing and `any` usage

    this._socket.on("receiveMessage", (data: unknown) => {
      const parsed = ReceiveMessageDataSchema.safeParse(data);
      const msg = parsed.success
        ? parsed.data.message
        : typeof data === "string"
          ? data
          : "";
      this.receiveMessageListeners.forEach((cb) => cb(msg));
    });

    this._socket.on("receive-chat-message", (data: unknown) => {
      const parsed = ReceiveChatMessageDataSchema.safeParse(data);
      const msg = parsed.success
        ? parsed.data.message
        : typeof data === "string"
          ? data
          : "";
      this.receiveChatMessageListeners.forEach((cb) => cb(msg));
    });

    this._socket.on("receive-whisper-message", (data: unknown) => {
      const parsed = ReceiveWhisperMessageDataSchema.safeParse(data);
      const msg = parsed.success
        ? parsed.data.message
        : typeof data === "string"
          ? data
          : "";
      this.receiveWhisperMessageListeners.forEach((cb) => cb(msg));
    });

    this._socket.on("receive-player-list", (data: unknown) => {
      const parsed = ReceivePlayerListDataSchema.safeParse(data);
      const playerList = parsed.success ? parsed.data.playerList : [];
      this.receivePlayerListListeners.forEach((cb) => cb(playerList));
    });

    this._socket.on("receive-new-player", (data: unknown) => {
      const parsed = ReceiveNewPlayerDataSchema.safeParse(data);
      if (parsed.success)
        this.receiveNewPlayerListeners.forEach((cb) => cb(parsed.data.player));
    });

    this._socket.on("remove-player", (data: unknown) => {
      const parsed = RemovePlayerDataSchema.safeParse(data);
      if (parsed.success)
        this.removePlayerListeners.forEach((cb) => cb(parsed.data.player));
    });
    this._socket.on("assign-player-role", (data: unknown) => {
      const parsed = AssignPlayerRoleDataSchema.safeParse(data);
      if (parsed.success)
        this.assignPlayerRoleListeners.forEach((cb) => cb(parsed.data));
    });

    this._socket.on("update-faction-role", (data: unknown) => {
      const parsed = UpdateFactionRoleDataSchema.safeParse(data);
      if (parsed.success)
        this.updateFactionRoleListeners.forEach((cb) => cb(parsed.data));
    });

    this._socket.on("update-player-role", (data: unknown) => {
      const parsed = UpdatePlayerRoleDataSchema.safeParse(data);
      if (parsed.success)
        this.updatePlayerRoleListeners.forEach((cb) => cb(parsed.data));
    });

    this._socket.on("update-player-visit", () => {
      this.updatePlayerVisitListeners.forEach((cb) => cb());
    });

    this._socket.on("update-day-time", (data: unknown) => {
      const parsed = UpdateDayTimeDataSchema.safeParse(data);
      if (parsed.success)
        this.updateDayTimeListeners.forEach((cb) => cb(parsed.data));
    });

    this._socket.on("disable-voting", () => {
      this.disableVotingListeners.forEach((cb) => cb());
    });

    this._socket.on("blockMessages", () => {
      this.blockMessagesListeners.forEach((cb) => cb());
    });
  }

  onReceiveMessage(listener: (msg: string) => void): void {
    this.receiveMessageListeners.push(listener);
  }
  onReceiveChatMessage(listener: (msg: string) => void): void {
    this.receiveChatMessageListeners.push(listener);
  }
  onReceiveWhisperMessage(listener: (msg: string) => void): void {
    this.receiveWhisperMessageListeners.push(listener);
  }
  onReceivePlayerList(
    listener: (
      playerList: {
        name: string;
        isAlive?: boolean;
        role?: string;
      }[],
    ) => void,
  ): void {
    this.receivePlayerListListeners.push(listener);
  }
  onReceiveNewPlayer(listener: (player: { name: string }) => void): void {
    this.receiveNewPlayerListeners.push(listener);
  }
  onRemovePlayer(listener: (player: { name: string }) => void): void {
    this.removePlayerListeners.push(listener);
  }
  onAssignPlayerRole(
    listener: (player: {
      name: string;
      role: string;
      dayVisitSelf: boolean;
      dayVisitOthers: boolean;
      dayVisitFaction: boolean;
      nightVisitSelf: boolean;
      nightVisitOthers: boolean;
      nightVisitFaction: boolean;
      nightVote: boolean;
    }) => void,
  ): void {
    this.assignPlayerRoleListeners.push(listener);
  }
  onUpdateFactionRole(
    listener: (data: { name: string; role: string }) => void,
  ): void {
    this.updateFactionRoleListeners.push(listener);
  }
  onUpdatePlayerRole(
    listener: (data: { name: string; role?: string }) => void,
  ): void {
    this.updatePlayerRoleListeners.push(listener);
  }
  onUpdatePlayerVisit(listener: () => void): void {
    this.updatePlayerVisitListeners.push(listener);
  }
  onUpdateDayTime(
    listener: (data: {
      time: Time;
      dayNumber: number;
      timeLeft: number;
    }) => void,
  ): void {
    this.updateDayTimeListeners.push(listener);
  }
  onDisableVoting(listener: () => void): void {
    this.disableVotingListeners.push(listener);
  }
  onBlockMessages(listener: () => void): void {
    this.blockMessagesListeners.push(listener);
  }

  close(): void {
    this._socket.removeAllListeners();
    this.receiveMessageListeners = [];
    this.receiveChatMessageListeners = [];
    this.receiveWhisperMessageListeners = [];
    this.receivePlayerListListeners = [];
    this.receiveNewPlayerListeners = [];
    this.removePlayerListeners = [];
    this.assignPlayerRoleListeners = [];
    this.updateFactionRoleListeners = [];
    this.updatePlayerRoleListeners = [];
    this.updatePlayerVisitListeners = [];
    this.updateDayTimeListeners = [];
    this.disableVotingListeners = [];
    this.blockMessagesListeners = [];
    this._socket.disconnect();
  }
}

// Usage: pass a listener function to handle server events
// export const socket = new SocketIoClient((event) => { /* handle event */ });
