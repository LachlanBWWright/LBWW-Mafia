/**
 * Wraps a PartyKit Connection to match the GamePlayerSocket interface
 * expected by Room and Player classes.
 */
import type * as Party from "partykit/server";
import type { GamePlayerSocket } from "../socket.js";
import type { Room } from "../../model/rooms/room.js";

export class PartykitPlayerSocket implements GamePlayerSocket {
  id: string;
  data: { roomObject?: Room; position?: number };
  private connection: Party.Connection;

  constructor(connection: Party.Connection) {
    this.connection = connection;
    this.id = connection.id;
    this.data = {};
  }

  join(_room: string): void {
    // No-op: in PartyKit each party instance IS the room
  }

  sendCallback(callbackId: string, ...args: unknown[]): void {
    const message = JSON.stringify({ type: "callback", callbackId, args });
    this.connection.send(message);
  }
}
