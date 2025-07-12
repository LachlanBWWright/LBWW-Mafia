import { AbstractSocketClient } from "./AbstractSocketClient";
import PartySocket from "partysocket";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  //Client to server messages
  PlayerJoinRoomMessage,
  MessageSentByUserMessage,
  HandleVoteMessage,
  HandleVisitMessage,
  HandleWhisperMessage,
  MessageToServer, //All
  //Server to client messages
  ReceiveMessage,
  BlockMessages,
  ReceiveNewPlayer,
  RemovePlayer,
  ReceivePlayerList,
  ReceiveChatMessage,
  ReceiveWhisperMessage,
  UpdateDayTime,
  DisableVoting,
  UpdatePlayerRole,
  AssignPlayerRole,
  UpdateFactionRole,
  ReceiveRole,
  UpdatePlayerVisit,
  MessageToClient, //All
} from "../../../shared/socketTypes/socketTypes";

export class PartyKitSocketClient extends AbstractSocketClient {
  socket: PartySocket;
  receiveMessageListeners: ((msg: string) => void)[] = [];

  constructor() {
    super();
    this.socket = new PartySocket({
      host: "https://localhost:1999",
      room: "TESTROOMNAME",
    });
    this.socket.addEventListener("open", (event) => {
      console.log(event);
    });
    this.socket.addEventListener("message", (event: MessageEvent<string>) => {
      console.log("EVENT DATA:", event.data);

      console.log("Typeof event.data:", typeof event.data);
      // Parse the incoming message
      try {
        //Ignore unsafe ts cast
        //TODO: Add zod validation
        //eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data: MessageToClient = JSON.parse(event.data);
        // Dispatch to the correct listeners based on event name
        switch (data.name) {
          case "receiveMessage":
            this.receiveMessageListeners.forEach((cb) => cb(data.data.message));
            break;
          case "receive-chat-message":
            this.receiveChatMessageListeners.forEach((cb) =>
              cb(data.data.message),
            );
            break;
          case "receive-whisper-message":
            this.receiveWhisperMessageListeners.forEach((cb) =>
              cb(data.data.message),
            );
            break;
          case "receive-player-list":
            this.receivePlayerListListeners.forEach((cb) =>
              cb(data.data.playerList),
            );
            break;
          case "receive-new-player":
            this.receiveNewPlayerListeners.forEach((cb) =>
              cb(data.data.player),
            );
            break;
          case "remove-player":
            this.removePlayerListeners.forEach((cb) => cb(data.data.player));
            break;
          case "assign-player-role":
            this.assignPlayerRoleListeners.forEach((cb) => cb(data.data));
            break;
          case "update-faction-role":
            this.updateFactionRoleListeners.forEach((cb) => cb(data.data));
            break;
          case "update-player-role":
            this.updatePlayerRoleListeners.forEach((cb) => cb(data.data));
            break;
          case "update-player-visit":
            this.updatePlayerVisitListeners.forEach((cb) => cb());
            break;
          case "update-day-time":
            this.updateDayTimeListeners.forEach((cb) => cb(data.data));
            break;
          case "disable-voting":
            this.disableVotingListeners.forEach((cb) => cb());
            break;
          case "blockMessages":
            this.blockMessagesListeners.forEach((cb) => cb());
            break;
          default:
            console.warn("Unknown event name from PartyKit message:", data);
        }
      } catch (err) {
        console.error("Failed to parse PartyKit message:", event.data, err);
      }
    });
    this.socket.addEventListener("error", (event) => {
      console.log(event);
    });
    this.socket.addEventListener("close", (event) => {
      console.log(event);
    });
  }

  sendDisconnect(): void {
    // Implement PartyKit send logic here
    //this.socket.send(data: )
  }
  sendPlayerJoinRoom(
    captchaToken: string,
    cb: (result: string | number) => void,
  ): void {
    // Implement PartyKit send logic here
    this.socket.send(
      JSON.stringify({
        name: "playerJoinRoom",
        data: { captchaToken },
      } satisfies PlayerJoinRoomMessage),
    );
  }
  sendMessageSentByUser(message: string, isDay: boolean): void {
    this.socket.send(
      JSON.stringify({
        name: "messageSentByUser",
        data: { message, isDay },
      } satisfies MessageSentByUserMessage),
    );
  }

  sendHandleVote(recipient: number | null, isDay: boolean): void {
    this.socket.send(
      JSON.stringify({
        name: "handleVote",
        data: { recipient, isDay },
      } satisfies HandleVoteMessage),
    );
  }

  sendHandleVisit(recipient: number | null, isDay: boolean): void {
    this.socket.send(
      JSON.stringify({
        name: "handleVisit",
        data: { recipient, isDay },
      } satisfies HandleVisitMessage),
    );
  }

  sendHandleWhisper(recipient: number, message: string, isDay: boolean): void {
    this.socket.send(
      JSON.stringify({
        name: "handleWhisper",
        data: { recipient, message, isDay },
      } satisfies HandleWhisperMessage),
    );
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
        isAlive: boolean | undefined;
        role: string;
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
      time: string;
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
