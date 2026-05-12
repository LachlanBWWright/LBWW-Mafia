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
import { partykitClientEventEnvelopeSchema } from "../../../shared/communication/protocol.js";
import {
  parseJoinRoomToken,
  parseMessageSentPayload,
  parseVisitPayload,
  parseVotePayload,
  parseWhisperPayload,
} from "../socketValidation.js";

const DEFAULT_ROOM_SIZE = 13;

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
   * @param room - The PartyKit room instance
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
   * @param request - The HTTP request
   * @returns HTTP response with CORS headers
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
   * @param connection - The new player connection
   * @param _ctx - Connection context (unused)
   * @returns
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
   * @param message - Raw message data
   * @param sender - The connection that sent the message
   * @returns
   */
  onMessage(
    message: string | ArrayBuffer | ArrayBufferView,
    sender: Party.Connection,
  ) {
    const raw =
      typeof message === "string" ? message : new TextDecoder().decode(message);

    let parsedUnknown: unknown;
    try {
      parsedUnknown = JSON.parse(raw);
    } catch {
      console.error("PartyKit: Failed to parse message:", raw);
      return;
    }

    const parsed = partykitClientEventEnvelopeSchema.safeParse(parsedUnknown);
    if (!parsed.success) return;

    const playerSocket = this.playerSockets.get(sender.id);
    if (!playerSocket) return;

    switch (parsed.data.event) {
      case ClientEvent.PlayerJoinRoom: {
        const captchaToken = parseJoinRoomToken(parsed.data.args[0]);
        if (!captchaToken) {
          break;
        }
        playerSocket.data.roomObject = this.gameRoom;
        const result = this.gameRoom.addUser(playerSocket);

        if (parsed.data.callbackId) {
          playerSocket.sendCallback(parsed.data.callbackId, result);
        }
        break;
      }

      case ClientEvent.MessageSentByUser: {
        const payload = parseMessageSentPayload(
          parsed.data.args[0],
          parsed.data.args[1],
        );
        if (!payload || playerSocket.data.roomObject === undefined) {
          break;
        }
        playerSocket.data.roomObject.handleSentMessage(
          playerSocket,
          payload.message,
          payload.phase,
        );
        break;
      }

      case ClientEvent.HandleVote: {
        const payload = parseVotePayload(parsed.data.args[0], parsed.data.args[1]);
        if (!payload || playerSocket.data.roomObject === undefined) {
          break;
        }
        playerSocket.data.roomObject.handleVote(
          playerSocket,
          payload.recipient,
          payload.phase,
        );
        break;
      }

      case ClientEvent.HandleVisit: {
        const payload = parseVisitPayload(
          parsed.data.args[0],
          parsed.data.args[1],
        );
        if (!payload || playerSocket.data.roomObject === undefined) {
          break;
        }
        playerSocket.data.roomObject.handleVisit(
          playerSocket,
          payload.recipient,
          payload.phase,
        );
        break;
      }

      case ClientEvent.HandleWhisper: {
        const payload = parseWhisperPayload(
          parsed.data.args[0],
          parsed.data.args[1],
          parsed.data.args[2],
        );
        if (!payload || playerSocket.data.roomObject === undefined) {
          break;
        }
        playerSocket.data.roomObject.handleWhisper(
          playerSocket,
          payload.recipient,
          payload.message,
          payload.phase,
        );
        break;
      }
    }
  }

  /**
   * Handles player disconnections.
   * Removes the player from the game room and cleans up the socket adapter.
   *
   * @param connection - The closed connection
   * @returns
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
   * @param connection - The connection that encountered an error
   * @param error - The error that occurred
   * @returns
   */
  onError(connection: Party.Connection, error: Error) {
    console.error(`PartyKit: Connection error ${connection.id}:`, error);
    this.onClose(connection);
  }
}
