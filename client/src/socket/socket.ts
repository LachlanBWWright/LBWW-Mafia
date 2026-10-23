import { Socket, io } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@mernmafia/shared/communication/events";

/**
 * Singleton Socket.IO client instance connected to the game server.
 * Handles all real-time communication between client and server.
 */
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
  io("/");

console.log(socket);
socket.connect();
