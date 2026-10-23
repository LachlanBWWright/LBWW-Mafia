import { Server, Socket } from "socket.io";
import { httpServer } from "./httpServer.js";
import { Room } from "../model/rooms/room.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
} from "../../shared/communication/events.js";
import {
  ClientEvent,
} from "../../shared/communication/events.js";
import {
  isJoinRoomCallback,
  parseJoinRoomToken,
  parseMessageSentPayload,
  parseVisitPayload,
  parseVotePayload,
  parseWhisperPayload,
} from "./socketValidation.js";
import { verifyGameIdentity } from "./gameIdentity.js";

/**
 * Data attached to each Socket connection.
 * Stores the player's current room and position in the player list.
 *
 * @typedef {Object} SocketData
 * @property {Room} roomObject - The game room this player is in
 * @property {number} position - The player's index in the room's player list
 */
export type SocketData = {
  roomObject: Room;
  position: number;
};

/**
 * Type-safe Socket instance for game connections.
 * Properly types client-to-server events, server-to-client events, and attached data.
 *
 * @typedef {Socket} PlayerSocket
 */
export type PlayerSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Creates a Socket.IO server configured for game communications.
 * Sets up CORS and binds to the HTTP server.
 *
 * @returns Configured Socket.IO server instance
 */
export function createSocketIoServer() {
  return new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: ["http://localhost:3000"],
    },
  });
}

/**
 * Adds event listeners to the Socket.IO server for all game events.
 * Manages player connections, disconnections, and all game actions.
 *
 * @param socketIoServer - The Socket.IO server to add listeners to
 * @param roomSize - The maximum number of players per game room
 * @returns
 */
export function addSocketListeners(
  socketIoServer: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  roomSize: number,
) {
  const playRoom: { current: Room | undefined } = { current: undefined };

  socketIoServer.on("connection", (socket: PlayerSocket) => {
    console.log("New Connection");
    /**
     * Handles player and spectator join requests.
     * Creates a new room if the current room is full or not started,
     * then adds the player to the room.
     */
    for (const joinEvent of [
      ClientEvent.PlayerJoinRoom,
      ClientEvent.SpectatorJoinRoom,
    ] as const)
      socket.on(
        joinEvent,
        async (captchaToken, identityTokenOrCallback, optionalCallback) => {
          const cb =
            typeof identityTokenOrCallback === "function"
              ? identityTokenOrCallback
              : optionalCallback;
          const identityToken =
            typeof identityTokenOrCallback === "string"
              ? identityTokenOrCallback
              : undefined;
          const parsedCaptchaToken = parseJoinRoomToken(captchaToken);
          if (parsedCaptchaToken === null || !isJoinRoomCallback(cb)) {
            return;
          }
          if (
            (joinEvent === ClientEvent.PlayerJoinRoom &&
              playRoom.current?.started) ||
            playRoom.current === undefined
          )
            playRoom.current = new Room(roomSize);
          socket.data.roomObject = playRoom.current;
          socket.join(playRoom.current.name);
          const result =
            joinEvent === ClientEvent.SpectatorJoinRoom
              ? socket.data.roomObject.addSpectator(
                  socket,
                  verifyGameIdentity(identityToken),
                )
              : socket.data.roomObject.addUser(
                  socket,
                  verifyGameIdentity(identityToken),
                );
          cb(result);
        },
      );

    /**
     * Handles player disconnections.
     * Removes the player from their room.
     */
    socket.on(ClientEvent.Disconnect, () => {
      if (socket.data.roomObject !== undefined) {
        socket.data.roomObject.removePlayer(socket.id);
      }
    });

    /**
     * Handles chat messages sent by players.
     * Validates message length (1-150 characters) before forwarding to room.
     */
    socket.on(ClientEvent.MessageSentByUser, (message, phase) => {
      const parsed = parseMessageSentPayload(message, phase);
      if (!parsed || socket.data.roomObject === undefined) {
        return;
      }
      socket.data.roomObject.handleSentMessage(
        socket,
        parsed.message,
        parsed.phase,
      );
    });

    /**
     * Handles voting actions during day/night phases.
     * Validates that recipient is a valid player index before processing.
     */
    socket.on(ClientEvent.ReadyForRematch, () =>
      socket.data.roomObject?.readyForRematch(socket),
    );
    socket.on(ClientEvent.HandleVote, (recipient, phase) => {
      const parsed = parseVotePayload(recipient, phase);
      if (!parsed || socket.data.roomObject === undefined) {
        return;
      }
      socket.data.roomObject.handleVote(socket, parsed.recipient, parsed.phase);
    });

    /**
     * Handles visit/action actions during day/night phases.
     * Validates that recipient is a valid player index or null before processing.
     */
    socket.on(ClientEvent.HandleVisit, (recipient, phase) => {
      const parsed = parseVisitPayload(recipient, phase);
      if (!parsed || socket.data.roomObject === undefined) {
        return;
      }
      socket.data.roomObject.handleVisit(
        socket,
        parsed.recipient,
        parsed.phase,
      );
    });

    /**
     * Handles private whisper messages during day phases.
     * Validates recipient index and message length (1-150 characters) before processing.
     */
    socket.on(ClientEvent.HandleWhisper, (recipient, message, phase) => {
      const parsed = parseWhisperPayload(recipient, message, phase);
      if (!parsed || socket.data.roomObject === undefined) {
        return;
      }
      socket.data.roomObject.handleWhisper(
        socket,
        parsed.recipient,
        parsed.message,
        parsed.phase,
      );
    });
  });
}
