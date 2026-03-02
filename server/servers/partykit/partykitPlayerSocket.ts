/**
 * Wraps a PartyKit Connection to match the GamePlayerSocket interface
 * expected by Room and Player classes.
 */
import type { GamePlayerSocket } from "@mernmafia/shared/communication/serverTypes";
import type { Room } from "../../model/rooms/room.js";

/** Minimal subset of Party.Connection that PartykitPlayerSocket requires. */
export type PartyConnectionAdapter = {
  id: string;
  send(msg: string): void;
};

export class PartykitPlayerSocket implements GamePlayerSocket {
  id: string;
  data: { roomObject?: Room; position?: number };
  private connection: PartyConnectionAdapter;

  constructor(connection: PartyConnectionAdapter) {
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
