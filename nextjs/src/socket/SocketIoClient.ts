import { AbstractSocketClient } from "./AbstractSocketClient";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../../../shared/socketTypes/socketTypes";
import { io, Socket } from "socket.io-client";

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
    this._socket.emit("playerJoinRoom", captchaToken, cb);
  }

  sendDisconnect(): void {
    this._socket.emit("disconnect");
  }

  sendMessageSentByUser(message: string, isDay: boolean): void {
    this._socket.emit("messageSentByUser", message, isDay);
  }

  sendHandleVote(recipient: number | null, isDay: boolean): void {
    this._socket.emit("handleVote", recipient, isDay);
  }

  sendHandleVisit(recipient: number | null, isDay: boolean): void {
    this._socket.emit("handleVisit", recipient, isDay);
  }

  sendHandleWhisper(recipient: number, message: string, isDay: boolean): void {
    this._socket.emit("handleWhisper", recipient, message, isDay);
  }

  private _setupListeners() {
    this._socket.on("receiveMessage", (msg: string) => {
      this.receiveMessageListeners.forEach((cb) => cb(msg));
    });
    this._socket.on("receive-chat-message", (msg: string) => {
      this.receiveChatMessageListeners.forEach((cb) => cb(msg));
    });
    this._socket.on("receive-whisper-message", (msg: string) => {
      this.receiveWhisperMessageListeners.forEach((cb) => cb(msg));
    });
    this._socket.on(
      "receive-player-list",
      (
        playerList: {
          name: string;
          isAlive: boolean | undefined;
          role: string;
        }[],
      ) => {
        this.receivePlayerListListeners.forEach((cb) => cb(playerList));
      },
    );
    this._socket.on("receive-new-player", (player: { name: string }) => {
      this.receiveNewPlayerListeners.forEach((cb) => cb(player));
    });
    this._socket.on("remove-player", (player: { name: string }) => {
      this.removePlayerListeners.forEach((cb) => cb(player));
    });
    this._socket.on(
      "assign-player-role",
      (player: {
        name: string;
        role: string;
        dayVisitSelf: boolean;
        dayVisitOthers: boolean;
        dayVisitFaction: boolean;
        nightVisitSelf: boolean;
        nightVisitOthers: boolean;
        nightVisitFaction: boolean;
        nightVote: boolean;
      }) => {
        this.assignPlayerRoleListeners.forEach((cb) => cb(player));
      },
    );
    this._socket.on(
      "update-faction-role",
      (data: { name: string; role: string }) => {
        this.updateFactionRoleListeners.forEach((cb) => cb(data));
      },
    );
    this._socket.on(
      "update-player-role",
      (data: { name: string; role?: string }) => {
        this.updatePlayerRoleListeners.forEach((cb) => cb(data));
      },
    );
    this._socket.on("update-player-visit", () => {
      this.updatePlayerVisitListeners.forEach((cb) => cb());
    });
    this._socket.on(
      "update-day-time",
      (data: { time: string; dayNumber: number; timeLeft: number }) => {
        this.updateDayTimeListeners.forEach((cb) => cb(data));
      },
    );
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
        isAlive: boolean | undefined;
        role: string;
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
      time: string;
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
