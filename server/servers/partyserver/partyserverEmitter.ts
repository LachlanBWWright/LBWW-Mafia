/**
 * PartyServer implementation of the GameEmitter interface.
 * Maps the `io.to(target).emit(event, data)` pattern used by game logic
 * to PartyServer's `connection.send()` and `room.broadcast()` APIs.
 *
 * In PartyServer each party instance IS a single room, so:
 *   - `to(roomName)` → broadcast to all connections in the party
 *   - `to(connectionId)` → send to a specific connection
 *   - `in(roomName)` → { disconnectSockets() } → close all connections
 */
import type {
  GameEmitter,
  EmitTarget,
  DisconnectTarget,
} from "@mernmafia/shared/communication/serverTypes";
import { PartyServerMessageType } from "@mernmafia/shared/communication/events";

/** Minimal room transport surface that PartyServerEmitter requires. */
export type ServerRoomAdapter = {
  broadcast(msg: string): void;
  getConnection(id: string): { send(msg: string): void } | undefined | null;
  getConnections(): Iterable<{ close(code?: number, reason?: string): void }>;
};

export class PartyServerEmitter implements GameEmitter {
  private serverRoom: ServerRoomAdapter;
  private roomName: string;

  constructor(serverRoom: ServerRoomAdapter, roomName: string) {
    this.serverRoom = serverRoom;
    this.roomName = roomName;
  }

  to(target: string): EmitTarget {
    if (target === this.roomName) {
      // Broadcast to all connections in this room.
      return {
        emit: (event: string, ...args: unknown[]) => {
          const message = JSON.stringify({
            type: PartyServerMessageType.Event,
            event,
            args,
          });
          this.serverRoom.broadcast(message);
        },
      };
    }

    // Send to a specific connection by ID
    return {
      emit: (event: string, ...args: unknown[]) => {
        const conn = this.serverRoom.getConnection(target);
        if (conn) {
          const message = JSON.stringify({
            type: PartyServerMessageType.Event,
            event,
            args,
          });
          conn.send(message);
        }
      },
    };
  }

  in(target: string): DisconnectTarget {
    if (target === this.roomName) {
      return {
        disconnectSockets: () => {
          for (const conn of this.serverRoom.getConnections()) {
            conn.close(1000, "Room closed");
          }
        },
      };
    }
    return { disconnectSockets: () => {} };
  }
}
