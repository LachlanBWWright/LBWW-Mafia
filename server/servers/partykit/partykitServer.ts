/**
 * PartyKit entry point for the Mafia game server.
 * Each PartyKit party instance hosts a single game room/match.
 *
 * This is a separate "main function" from the Socket.IO server (server.ts).
 * Deploy with: npx partykit dev server/servers/partykit/partykitServer.ts
 * or configure in partykit.json.
 */
import type * as Party from "partykit/server";
import { PartykitEmitter } from "./partykitEmitter.js";
import { PartykitPlayerSocket } from "./partykitPlayerSocket.js";
import { setGameEmitter } from "../emitter.js";
import { Room } from "../../model/rooms/room.js";
import { fromThrowable } from "neverthrow";

type ClientMessage = {
  type: "event";
  event: string;
  args: unknown[];
  callbackId?: string;
};

const runSafely = (context: string, action: () => void) => {
  const safeAction = fromThrowable(action, (error) => error);
  const result = safeAction();
  if (result.isErr()) {
    console.error(`${context}: ${String(result.error)}`);
  }
};

export default class MafiaPartyServer implements Party.Server {
  private gameRoom: Room;
  private roomSize: number;
  private playerSockets = new Map<string, PartykitPlayerSocket>();
  private debugMode: boolean;

  constructor(readonly room: Party.Room) {
    this.roomSize = 13;
    this.debugMode = true; // PartyKit mode skips CAPTCHA (no server-side HTTP for reCAPTCHA in CF Workers)
    this.gameRoom = new Room(this.roomSize);

    // Initialize the GameEmitter for this party instance
    const emitter = new PartykitEmitter(room, this.gameRoom.name);
    setGameEmitter(emitter);
  }

  onConnect(connection: Party.Connection, _ctx: Party.ConnectionContext) {
    console.log(`PartyKit: New connection ${connection.id}`);
    const playerSocket = new PartykitPlayerSocket(connection);
    this.playerSockets.set(connection.id, playerSocket);
  }

  onMessage(message: string | ArrayBuffer | ArrayBufferView, sender: Party.Connection) {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message as ArrayBuffer);

    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(raw) as ClientMessage;
    } catch {
      console.error("PartyKit: Failed to parse message:", raw);
      return;
    }

    if (parsed.type !== "event") return;

    const playerSocket = this.playerSockets.get(sender.id);
    if (!playerSocket) return;

    switch (parsed.event) {
      case "playerJoinRoom": {
        // In PartyKit mode, skip CAPTCHA and directly add player
        if (this.gameRoom.started) {
          // Create a new room if the current one already started
          this.gameRoom = new Room(this.roomSize);
          const emitter = new PartykitEmitter(this.room, this.gameRoom.name);
          setGameEmitter(emitter);
        }

        playerSocket.data.roomObject = this.gameRoom;
        const result = this.gameRoom.addPlayer(playerSocket);

        if (parsed.callbackId) {
          playerSocket.sendCallback(parsed.callbackId, result);
        }
        break;
      }

      case "messageSentByUser": {
        const [msg, isDay] = parsed.args as [string, boolean];
        runSafely("messageSentByUser error", () => {
          if (msg.length > 0 && msg.length <= 150) {
            if (playerSocket.data.roomObject !== undefined) {
              playerSocket.data.roomObject.handleSentMessage(
                playerSocket,
                msg,
                isDay,
              );
            }
          }
        });
        break;
      }

      case "handleVote": {
        const [recipient, isDay] = parsed.args as [number | null, boolean];
        runSafely("handleVote error", () => {
          if (typeof recipient === "number") {
            if (playerSocket.data.roomObject !== undefined) {
              playerSocket.data.roomObject.handleVote(
                playerSocket,
                recipient,
                isDay,
              );
            }
          }
        });
        break;
      }

      case "handleVisit": {
        const [recipient, isDay] = parsed.args as [number | null, boolean];
        runSafely("handleVisit error", () => {
          if (typeof recipient === "number" || recipient === null) {
            if (playerSocket.data.roomObject !== undefined) {
              playerSocket.data.roomObject.handleVisit(
                playerSocket,
                recipient,
                isDay,
              );
            }
          }
        });
        break;
      }

      case "handleWhisper": {
        const [recipient, msg, isDay] = parsed.args as [number, string, boolean];
        runSafely("handleWhisper error", () => {
          if (
            typeof recipient === "number" &&
            msg.length > 0 &&
            msg.length <= 150
          ) {
            if (playerSocket.data.roomObject !== undefined) {
              playerSocket.data.roomObject.handleWhisper(
                playerSocket,
                recipient,
                msg,
                isDay,
              );
            }
          }
        });
        break;
      }
    }
  }

  onClose(connection: Party.Connection) {
    console.log(`PartyKit: Connection closed ${connection.id}`);
    const playerSocket = this.playerSockets.get(connection.id);
    if (playerSocket?.data.roomObject) {
      runSafely("Disconnect error", () => {
        (playerSocket.data.roomObject as Room).removePlayer(connection.id);
      });
    }
    this.playerSockets.delete(connection.id);
  }

  onError(connection: Party.Connection, error: Error) {
    console.error(`PartyKit: Connection error ${connection.id}:`, error);
    this.onClose(connection);
  }
}
