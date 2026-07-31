import type { GamePlayerSocket } from "@mernmafia/shared/communication/serverTypes";
import type { Room } from "../rooms/room.js";

/**
 * Represents a connected client.
 * Holds the socket/communication layer for a single connection.
 * Users are created when a client connects and exist for the duration of the connection.
 */
export class User {
  socket: GamePlayerSocket;
  readonly socketId: string;
  readonly username: string;
  readonly userId?: string;

  constructor(socket: GamePlayerSocket, username: string, userId?: string) {
    this.socket = socket;
    this.socketId = socket.id;
    this.username = username;
    this.userId = userId;
  }
}

/**
 * Type stored in socket.data so Room can look up the associated User and position.
 */
export type UserSocketData = {
  roomObject?: Room;
  position?: number;
};
