/**
 * Wraps a PartyKit Connection to match the PlayerSocket interface
 * expected by Room and Player classes.
 */
import type * as Party from "partykit/server";

export class PartykitPlayerSocket {
  id: string;
  data: { roomObject?: unknown; position?: number };
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
