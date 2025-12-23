import { AbstractSocketClient } from "./AbstractSocketClient";
import PartySocket from "partysocket";
import { z } from "zod";
import { type Time } from "~/types/shared";
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
  JoinRoomCallbackSchema,
} from "./socketSchemas";
import type {
  //Client to server messages
  PlayerJoinRoomMessage,
  MessageSentByUserMessage,
  HandleVoteMessage,
  HandleVisitMessage,
  HandleWhisperMessage,
  //Server to client messages
} from "~/types/shared";

// Zod schema for validating MessageToClient
const messageToClientSchema = z.object({
  name: z.string(),
  data: z.any().optional(),
});

export class PartyKitSocketClient extends AbstractSocketClient {
  socket: PartySocket;
  receiveMessageListeners: ((msg: string) => void)[] = [];
  private _pendingJoinCallback?: (result: string | number) => void;

  constructor(host: string, room: string) {
    super();
    this.socket = new PartySocket({
      host,
      room,
    });
    this.socket.addEventListener("open", (_event) => {
      console.debug("PartyKit socket opened");
    });
    this.socket.addEventListener("message", (event: MessageEvent<string>) => {
      console.debug("PartyKit message received");

      console.debug("Type of partykit message:", typeof event.data);
      // Parse the incoming message
      try {
        // Validate incoming message with Zod
        const data = messageToClientSchema.parse(JSON.parse(event.data));
        // Dispatch to the correct listeners based on event name
        switch (data.name) {
          case "receiveMessage": {
            const parsed = ReceiveMessageDataSchema.safeParse(data.data);
            if (parsed.success) {
              const msg = parsed.data.message;
              for (const cb of this.receiveMessageListeners) cb(msg);
            }
            break;
          }
          case "receive-chat-message": {
            const parsed = ReceiveChatMessageDataSchema.safeParse(data.data);
            if (parsed.success) {
              const msg = parsed.data.message;
              for (const cb of this.receiveChatMessageListeners) cb(msg);
            }
            break;
          }
          case "receive-whisper-message": {
            const parsed = ReceiveWhisperMessageDataSchema.safeParse(data.data);
            if (parsed.success) {
              const msg = parsed.data.message;
              for (const cb of this.receiveWhisperMessageListeners) cb(msg);
            }
            break;
          }
          case "receive-player-list": {
            const parsed = ReceivePlayerListDataSchema.safeParse(data.data);
            if (parsed.success) {
              const playerList = parsed.data.playerList;
              for (const cb of this.receivePlayerListListeners) cb(playerList);
            }
            break;
          }
          case "receive-new-player": {
            const parsed = ReceiveNewPlayerDataSchema.safeParse(data.data);
            if (parsed.success) {
              const player = parsed.data.player;
              for (const cb of this.receiveNewPlayerListeners) cb(player);
            }
            break;
          }
          case "remove-player": {
            const parsed = RemovePlayerDataSchema.safeParse(data.data);
            if (parsed.success) {
              const player = parsed.data.player;
              for (const cb of this.removePlayerListeners) cb(player);
            }
            break;
          }
          case "joinRoomCallback": {
            // Server will send the numeric/string result for join (to mimic Socket.IO callback)
            if (this._pendingJoinCallback) {
              const cb = this._pendingJoinCallback;
              const parsedJoin = JoinRoomCallbackSchema.safeParse(data.data);
              if (parsedJoin.success) cb(parsedJoin.data.result);
              else cb(3);
              this._pendingJoinCallback = undefined;
            }
            break;
          }
          case "assign-player-role": {
            const parsed = AssignPlayerRoleDataSchema.safeParse(data.data);
            if (parsed.success) {
              const playerData = parsed.data;
              for (const cb of this.assignPlayerRoleListeners) cb(playerData);
            }
            break;
          }
          case "update-faction-role": {
            const parsed = UpdateFactionRoleDataSchema.safeParse(data.data);
            if (parsed.success) {
              const dataObj = parsed.data;
              for (const cb of this.updateFactionRoleListeners) cb(dataObj);
            }
            break;
          }
          case "update-player-role": {
            const parsed = UpdatePlayerRoleDataSchema.safeParse(data.data);
            if (parsed.success) {
              const dataObj = parsed.data;
              for (const cb of this.updatePlayerRoleListeners) cb(dataObj);
            }
            break;
          }
          case "update-player-visit":
            for (const cb of this.updatePlayerVisitListeners) cb();
            break;
          case "update-day-time": {
            const parsed = UpdateDayTimeDataSchema.safeParse(data.data);
            if (parsed.success) {
              const info = parsed.data;
              for (const cb of this.updateDayTimeListeners) cb(info);
            }
            break;
          }
          case "disable-voting":
            for (const cb of this.disableVotingListeners) cb();
            break;
          case "blockMessages":
            for (const cb of this.blockMessagesListeners) cb();
            break;
          default:
            console.warn(
              "Unknown event name from PartyKit message:",
              JSON.stringify(data),
            );
        }
      } catch (err) {
        console.error(
          "Failed to parse PartyKit message:",
          event.data,
          String(err),
        );
      }
    });
    this.socket.addEventListener("error", (_event) => {
      console.debug("PartyKit socket error");
    });
    this.socket.addEventListener("close", (_event) => {
      console.debug("PartyKit socket close");
    });
  }

  sendDisconnect(): void {
    // Implement PartyKit send logic here
    //this.socket.send(data: )
  }
  // Sends a join request and calls cb with the server result once the server responds
  sendPlayerJoinRoom(
    captchaToken: string,
    cb: (result: string | number) => void,
  ): void {
    // Register a temporary join callback
    this._pendingJoinCallback = cb;

    const playerJoinPayload: {
      name: "playerJoinRoom";
      data: PlayerJoinRoomMessage;
    } = { name: "playerJoinRoom", data: { playerUsername: captchaToken } };
    this.socket.send(JSON.stringify(playerJoinPayload));

    // Fallback timeout in case the server doesn't respond
    setTimeout(() => {
      if (this._pendingJoinCallback) {
        this._pendingJoinCallback(3); // Treat as room full / failure after timeout
        this._pendingJoinCallback = undefined;
      }
    }, 5000);
  }
  sendMessageSentByUser(message: string, isDay: boolean): void {
    const messageSentPayload: {
      name: "messageSentByUser";
      data: MessageSentByUserMessage;
    } = { name: "messageSentByUser", data: { message, isDay } };
    this.socket.send(JSON.stringify(messageSentPayload));
  }

  sendHandleVote(recipient: number | null, isDay: boolean): void {
    const handleVotePayload: { name: "handleVote"; data: HandleVoteMessage } = {
      name: "handleVote",
      data: { recipient, isDay },
    };
    this.socket.send(JSON.stringify(handleVotePayload));
  }

  sendHandleVisit(recipient: number | null, isDay: boolean): void {
    const handleVisitPayload: {
      name: "handleVisit";
      data: HandleVisitMessage;
    } = { name: "handleVisit", data: { recipient, isDay } };
    this.socket.send(JSON.stringify(handleVisitPayload));
  }

  sendHandleWhisper(recipient: number, message: string, isDay: boolean): void {
    const handleWhisperPayload: {
      name: "handleWhisper";
      data: HandleWhisperMessage;
    } = { name: "handleWhisper", data: { recipient, message, isDay } };
    this.socket.send(JSON.stringify(handleWhisperPayload));
  }

  onReceiveMessage(listener: (msg: string) => void): () => void {
    this.receiveMessageListeners.push(listener);
    return () => {
      this.receiveMessageListeners = this.receiveMessageListeners.filter(
        (l) => l !== listener,
      );
    };
  }
  onReceiveChatMessage(listener: (msg: string) => void): () => void {
    this.receiveChatMessageListeners.push(listener);
    return () => {
      this.receiveChatMessageListeners =
        this.receiveChatMessageListeners.filter((l) => l !== listener);
    };
  }
  onReceiveWhisperMessage(listener: (msg: string) => void): () => void {
    this.receiveWhisperMessageListeners.push(listener);
    return () => {
      this.receiveWhisperMessageListeners =
        this.receiveWhisperMessageListeners.filter((l) => l !== listener);
    };
  }
  onReceivePlayerList(
    listener: (
      playerList: {
        name: string;
        isAlive?: boolean;
        role?: string;
      }[],
    ) => void,
  ): () => void {
    this.receivePlayerListListeners.push(listener);
    return () => {
      this.receivePlayerListListeners = this.receivePlayerListListeners.filter(
        (l) => l !== listener,
      );
    };
  }
  onReceiveNewPlayer(listener: (player: { name: string }) => void): () => void {
    this.receiveNewPlayerListeners.push(listener);
    return () => {
      this.receiveNewPlayerListeners = this.receiveNewPlayerListeners.filter(
        (l) => l !== listener,
      );
    };
  }
  onRemovePlayer(listener: (player: { name: string }) => void): () => void {
    this.removePlayerListeners.push(listener);
    return () => {
      this.removePlayerListeners = this.removePlayerListeners.filter(
        (l) => l !== listener,
      );
    };
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
  ): () => void {
    this.assignPlayerRoleListeners.push(listener);
    return () => {
      this.assignPlayerRoleListeners = this.assignPlayerRoleListeners.filter(
        (l) => l !== listener,
      );
    };
  }
  onUpdateFactionRole(
    listener: (data: { name: string; role: string }) => void,
  ): () => void {
    this.updateFactionRoleListeners.push(listener);
    return () => {
      this.updateFactionRoleListeners = this.updateFactionRoleListeners.filter(
        (l) => l !== listener,
      );
    };
  }
  onUpdatePlayerRole(
    listener: (data: { name: string; role?: string }) => void,
  ): () => void {
    this.updatePlayerRoleListeners.push(listener);
    return () => {
      this.updatePlayerRoleListeners = this.updatePlayerRoleListeners.filter(
        (l) => l !== listener,
      );
    };
  }
  onUpdatePlayerVisit(listener: () => void): () => void {
    this.updatePlayerVisitListeners.push(listener);
    return () => {
      this.updatePlayerVisitListeners = this.updatePlayerVisitListeners.filter(
        (l) => l !== listener,
      );
    };
  }
  onUpdateDayTime(
    listener: (data: {
      time: Time;
      dayNumber: number;
      timeLeft: number;
    }) => void,
  ): () => void {
    this.updateDayTimeListeners.push(listener);
    return () => {
      this.updateDayTimeListeners = this.updateDayTimeListeners.filter(
        (l) => l !== listener,
      );
    };
  }
  onDisableVoting(listener: () => void): () => void {
    this.disableVotingListeners.push(listener);
    return () => {
      this.disableVotingListeners = this.disableVotingListeners.filter(
        (l) => l !== listener,
      );
    };
  }
  onBlockMessages(listener: () => void): () => void {
    this.blockMessagesListeners.push(listener);
    return () => {
      this.blockMessagesListeners = this.blockMessagesListeners.filter(
        (l) => l !== listener,
      );
    };
  }
  close(): void {
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
  }
}

// Usage: pass a listener function to handle server events
// export const partykitSocket = new PartyKitSocketClient();
