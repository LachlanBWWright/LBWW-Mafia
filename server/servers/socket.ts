import { Server, Socket } from "socket.io";
import axios from "axios";
import { fromThrowable, ResultAsync } from "neverthrow";
import { httpServer } from "./httpServer.js";
import { Room } from "../model/rooms/room.js";
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents } from "../../shared/communication/events.js";
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
 * @returns {Server} Configured Socket.IO server instance
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

/**
 * Safely executes an action with error logging.
 * Wraps the action in a try-catch via neverthrow and logs any errors.
 * 
 * @param {string} context - Description of the action for error logging
 * @param {() => void} action - The action to execute safely
 * @returns {void}
 */
const runSafely = (context: string, action: () => void) => {
  const safeAction = fromThrowable(action, (error) => error);
  const result = safeAction();

  if (result.isErr()) {
    console.error(`${context}: ${String(result.error)}`);
  }
};

/**
 * Adds event listeners to the Socket.IO server for all game events.
 * Manages player connections, disconnections, and all game actions.
 * 
 * @param {Server} socketIoServer - The Socket.IO server to add listeners to
 * @param {number} roomSize - The maximum number of players per game room
 * @returns {void}
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
            } else cb(2);
          },
          (error) => {
            console.error(`Captcha verification failed: ${String(error)}`);
            cb(2);
          },
        );
      },
    );

    /**
     * Handles player disconnections.
     * Removes the player from their room.
     */
    socket.on(ClientEvent.Disconnect, () => {
      runSafely("Disconnect error", () => {
        if (socket.data.roomObject !== undefined) {
          socket.data.roomObject.removePlayer(socket.id);
        }
      });
    });

    /**
     * Handles chat messages sent by players.
     * Validates message length (1-150 characters) before forwarding to room.
     */
    socket.on(ClientEvent.MessageSentByUser, (message, isDay: boolean) => {
      runSafely("messageSentByUser error", () => {
        if (message.length > 0 && message.length <= 150) {
          if (socket.data.roomObject !== undefined)
            socket.data.roomObject.handleSentMessage(socket, message, isDay);
        }
      });
    });

    /**
     * Handles voting actions during day/night phases.
     * Validates that recipient is a valid player index before processing.
     */
    socket.on(ClientEvent.HandleVote, (recipient, isDay: boolean) => {
      runSafely("handleVote error", () => {
        if (typeof recipient === "number") {
          if (socket.data.roomObject !== undefined)
            socket.data.roomObject.handleVote(socket, recipient, isDay);
        }
      });
    });

    /**
     * Handles visit/action actions during day/night phases.
     * Validates that recipient is a valid player index or null before processing.
     */
    socket.on(ClientEvent.HandleVisit, (recipient, isDay: boolean) => {
      runSafely("handleVisit error", () => {
        if (typeof recipient === "number" || recipient === null) {
          if (socket.data.roomObject !== undefined)
            socket.data.roomObject.handleVisit(socket, recipient, isDay);
        }
      });
    });

    /**
     * Handles private whisper messages during day phases.
     * Validates recipient index and message length (1-150 characters) before processing.
     */
    socket.on(ClientEvent.HandleWhisper, (recipient, message, isDay) => {
      runSafely("handleWhisper error", () => {
        if (
          typeof recipient === "number" &&
          message.length > 0 &&
          message.length <= 150
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
  });
}
