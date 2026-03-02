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
import { ClientEvent } from "../../../shared/communication/events.js";
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

  onMessage(
    message: string | ArrayBuffer | ArrayBufferView,
    sender: Party.Connection,
  ) {
    const raw =
      typeof message === "string" ? message : new TextDecoder().decode(message);

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
      case ClientEvent.PlayerJoinRoom: {
        // In PartyKit mode, skip CAPTCHA and directly add player
        if (this.gameRoom.started) {
          // Create a new room if the current one already started
          this.gameRoom = new Room(this.roomSize);
          const emitter = new PartykitEmitter(this.room, this.gameRoom.name);
          setGameEmitter(emitter);
        }

        playerSocket.data.roomObject = this.gameRoom;
        const result = this.gameRoom.addUser(playerSocket);

        if (parsed.callbackId) {
          playerSocket.sendCallback(parsed.callbackId, result);
        }
        break;
      }

      case ClientEvent.MessageSentByUser: {
        const msg = parsed.args[0];
        const isDay = parsed.args[1];
        if (typeof msg !== "string" || typeof isDay !== "boolean") break;
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

      case ClientEvent.HandleVote: {
        const recipient = parsed.args[0];
        const isDay = parsed.args[1];
        if (
          (typeof recipient !== "number" && recipient !== null) ||
          typeof isDay !== "boolean"
        )
          break;
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

      case ClientEvent.HandleVisit: {
        const recipient = parsed.args[0];
        const isDay = parsed.args[1];
        if (
          (typeof recipient !== "number" && recipient !== null) ||
          typeof isDay !== "boolean"
        )
          break;
        const safeRecipient = recipient as number | null;
        runSafely("handleVisit error", () => {
          if (playerSocket.data.roomObject !== undefined) {
            playerSocket.data.roomObject.handleVisit(
              playerSocket,
              safeRecipient,
              isDay,
            );
          }
        });
        break;
      }

      case ClientEvent.HandleWhisper: {
        const recipient = parsed.args[0];
        const msg = parsed.args[1];
        const isDay = parsed.args[2];
        if (
          typeof recipient !== "number" ||
          typeof msg !== "string" ||
          typeof isDay !== "boolean"
        )
          break;
        runSafely("handleWhisper error", () => {
          if (msg.length > 0 && msg.length <= 150) {
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
    const room = playerSocket?.data.roomObject;
    if (room) {
      runSafely("Disconnect error", () => {
        room.removePlayer(connection.id);
      });
    }
    this.playerSockets.delete(connection.id);
  }

  onError(connection: Party.Connection, error: Error) {
    console.error(`PartyKit: Connection error ${connection.id}:`, error);
    this.onClose(connection);
  }
}
