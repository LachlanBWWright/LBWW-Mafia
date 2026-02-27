/**
 * PartyKit implementation of the GameEmitter interface.
 * Maps the `io.to(target).emit(event, data)` pattern used by game logic
 * to PartyKit's `connection.send()` and `room.broadcast()` APIs.
 *
 * In PartyKit each party instance IS a single room, so:
 *   - `to(roomName)` → broadcast to all connections in the party
 *   - `to(connectionId)` → send to a specific connection
 *   - `in(roomName)` → { disconnectSockets() } → close all connections
 */
import type * as Party from "partykit/server";
import type { GameEmitter, EmitTarget, DisconnectTarget } from "../../../shared/communication/serverTypes.js";

export class PartykitEmitter implements GameEmitter {
  private partyRoom: Party.Room;
  private roomName: string;

  constructor(partyRoom: Party.Room, roomName: string) {
    this.partyRoom = partyRoom;
    this.roomName = roomName;
  }

  to(target: string): EmitTarget {
    if (target === this.roomName) {
      // Broadcast to all connections in this party room
      return {
        emit: (event: string, ...args: unknown[]) => {
          const message = JSON.stringify({ type: "event", event, args });
          this.partyRoom.broadcast(message);
        },
      };
    }

    // Send to a specific connection by ID
    return {
      emit: (event: string, ...args: unknown[]) => {
        const conn = this.partyRoom.getConnection(target);
        if (conn) {
          const message = JSON.stringify({ type: "event", event, args });
          conn.send(message);
        }
      },
    };
  }

  in(target: string): DisconnectTarget {
    if (target === this.roomName) {
      return {
        disconnectSockets: () => {
          for (const conn of this.partyRoom.getConnections()) {
            conn.close(1000, "Room closed");
          }
        },
      };
    }
    return { disconnectSockets: () => {} };
  }
}
