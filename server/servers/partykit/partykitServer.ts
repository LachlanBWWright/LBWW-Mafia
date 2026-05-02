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

type ClientMessage = {
  type: "event";
  event: string;
  args: unknown[];
  callbackId?: string;
};

const DEFAULT_ROOM_SIZE = 13;
const MAX_MESSAGE_LENGTH = 150;

/**
 * PartyKit server handler for Mafia game.
 * Manages one game room per PartyKit party instance.
 * Handles player connections, messages, and game events.
 */
export default class MafiaPartyServer implements Party.Server {
  private gameRoom: Room;
  private roomSize: number;
  private playerSockets = new Map<string, PartykitPlayerSocket>();
  private debugMode: boolean;

  /**
   * Initializes a new Mafia game room for this PartyKit party instance.
   * Sets up the GameEmitter singleton for this instance.
   *
   * @param {Party.Room} room - The PartyKit room instance
   */
  constructor(readonly room: Party.Room) {
    this.roomSize = DEFAULT_ROOM_SIZE;

    this.gameRoom = new Room(this.roomSize, room.id);

    // Initialize the GameEmitter for this party instance
    const emitter = new PartykitEmitter(room, this.gameRoom.name);
    setGameEmitter(emitter);
  }

  /**
   * Handles HTTP requests to the PartyKit server.
   * Supports CORS and returns 404 for non-CORS requests.
   *
   * @param {Party.Request} request - The HTTP request
   * @returns {Response} HTTP response with CORS headers
   */
  onRequest(request: Party.Request): Response {
    const origin = request.headers.get("Origin") ?? "*";
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  /**
   * Handles new player connections to this party instance.
   * Creates a socket adapter for the player and stores it.
   *
   * @param {Party.Connection} connection - The new player connection
   * @param {Party.ConnectionContext} _ctx - Connection context (unused)
   * @returns {void}
   */
  onConnect(connection: Party.Connection, _ctx: Party.ConnectionContext) {
    console.log(`PartyKit: New connection ${connection.id}`);
    const playerSocket = new PartykitPlayerSocket(connection);
    this.playerSockets.set(connection.id, playerSocket);
  }

  /**
   * Handles incoming messages from players.
   * Routes game events (join, message, vote, visit, whisper) to the game room.
   * Parses JSON messages and validates event types before processing.
   *
   * @param {string | ArrayBuffer | ArrayBufferView} message - Raw message data
   * @param {Party.Connection} sender - The connection that sent the message
   * @returns {void}
   */
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
        if (msg.length > 0 && msg.length <= MAX_MESSAGE_LENGTH) {
          if (playerSocket.data.roomObject !== undefined) {
            playerSocket.data.roomObject.handleSentMessage(
              playerSocket,
              msg,
              isDay,
            );
          }
        }
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
        if (typeof recipient === "number") {
          if (playerSocket.data.roomObject !== undefined) {
            playerSocket.data.roomObject.handleVote(
              playerSocket,
              recipient,
              isDay,
            );
          }
        }
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
        if (playerSocket.data.roomObject !== undefined) {
          playerSocket.data.roomObject.handleVisit(
            playerSocket,
            safeRecipient,
            isDay,
          );
        }
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
        if (msg.length > 0 && msg.length <= MAX_MESSAGE_LENGTH) {
          if (playerSocket.data.roomObject !== undefined) {
            playerSocket.data.roomObject.handleWhisper(
              playerSocket,
              recipient,
              msg,
              isDay,
            );
          }
        }
        break;
      }
    }
  }

  /**
   * Handles player disconnections.
   * Removes the player from the game room and cleans up the socket adapter.
   *
   * @param {Party.Connection} connection - The closed connection
   * @returns {void}
   */
  onClose(connection: Party.Connection) {
    console.log(`PartyKit: Connection closed ${connection.id}`);
    const playerSocket = this.playerSockets.get(connection.id);
    const room = playerSocket?.data.roomObject;
    if (room) {
      room.removePlayer(connection.id);
    }
    this.playerSockets.delete(connection.id);
  }

  /**
   * Handles connection errors by closing the connection and cleaning up.
   *
   * @param {Party.Connection} connection - The connection that encountered an error
   * @param {Error} error - The error that occurred
   * @returns {void}
   */
  onError(connection: Party.Connection, error: Error) {
    console.error(`PartyKit: Connection error ${connection.id}:`, error);
    this.onClose(connection);
  }
}
