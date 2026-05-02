import { Server, Socket } from "socket.io";
import axios from "axios";
import { ResultAsync } from "neverthrow";
import { httpServer } from "./httpServer.js";
import { Room } from "../model/rooms/room.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
} from "../../shared/communication/events.js";
import { ClientEvent } from "../../shared/communication/events.js";

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
 * Whether to run in debug mode, disabling CAPTCHA verification.
 * Set via DEBUG or debug environment variables.
 *
 * @type {boolean}
 */
const DEBUG_MODE =
  process.env.DEBUG?.toLowerCase() === "true" ||
  process.env.debug?.toLowerCase() === "true";

const CAPTCHA_FAILURE_CODE = 2;
const CHAT_MESSAGE_MIN_LENGTH = 1;
const CHAT_MESSAGE_MAX_LENGTH = 150;

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
     * Handles player join requests with CAPTCHA verification.
     * Creates a new room if the current room is full or not started,
     * then adds the player to the room.
     */
    socket.on(
      ClientEvent.PlayerJoinRoom,
      async (captchaToken: string, cb: (code: string | number) => void) => {
        await ResultAsync.fromPromise(
          axios.post(
            `https://www.google.com/recaptcha/api/siteverify?response=${captchaToken}&secret=${process.env.CAPTCHA_KEY}`,
          ),
          (error) => error,
        ).match(
          (res) => {
            if (res.data.success || DEBUG_MODE) {
              console.log("Captcha Success");
              if (playRoom.current?.started || playRoom.current === undefined)
                playRoom.current = new Room(roomSize);
              if (playRoom.current !== undefined) {
                socket.data.roomObject = playRoom.current;
                socket.join(playRoom.current.name);
                const result = socket.data.roomObject.addUser(socket);
                console.log("Result: " + result);
                cb(result);
              }
            } else cb(CAPTCHA_FAILURE_CODE);
          },
          (error) => {
            console.error(`Captcha verification failed: ${String(error)}`);
            cb(CAPTCHA_FAILURE_CODE);
          },
        );
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
    socket.on(ClientEvent.MessageSentByUser, (message, isDay: boolean) => {
      if (
        message.length >= CHAT_MESSAGE_MIN_LENGTH &&
        message.length <= CHAT_MESSAGE_MAX_LENGTH
      ) {
        if (socket.data.roomObject !== undefined)
          socket.data.roomObject.handleSentMessage(socket, message, isDay);
      }
    });

    /**
     * Handles voting actions during day/night phases.
     * Validates that recipient is a valid player index before processing.
     */
    socket.on(ClientEvent.HandleVote, (recipient, isDay: boolean) => {
      if (typeof recipient === "number") {
        if (socket.data.roomObject !== undefined)
          socket.data.roomObject.handleVote(socket, recipient, isDay);
      }
    });

    /**
     * Handles visit/action actions during day/night phases.
     * Validates that recipient is a valid player index or null before processing.
     */
    socket.on(ClientEvent.HandleVisit, (recipient, isDay: boolean) => {
      if (typeof recipient === "number" || recipient === null) {
        if (socket.data.roomObject !== undefined)
          socket.data.roomObject.handleVisit(socket, recipient, isDay);
      }
    });

    /**
     * Handles private whisper messages during day phases.
     * Validates recipient index and message length (1-150 characters) before processing.
     */
    socket.on(ClientEvent.HandleWhisper, (recipient, message, isDay) => {
      if (
        typeof recipient === "number" &&
        message.length >= CHAT_MESSAGE_MIN_LENGTH &&
        message.length <= CHAT_MESSAGE_MAX_LENGTH
      ) {
        if (socket.data.roomObject !== undefined)
          socket.data.roomObject.handleWhisper(
            socket,
            recipient,
            message,
            isDay,
          );
      }
    });
  });
}
