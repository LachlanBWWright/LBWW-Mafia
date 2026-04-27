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

  /**
   * Creates a new PartyKit-based game player socket adapter.
   * 
   * @param {PartyConnectionAdapter} connection - The underlying PartyKit connection
   */
  constructor(connection: PartyConnectionAdapter) {
    this.connection = connection;
    this.id = connection.id;
    this.data = {};
  }

  /**
   * Joins a room (no-op in PartyKit since each party instance is already a room).
   * 
   * @param {string} _room - The room name (unused in PartyKit)
   * @returns {void}
   */
  join(_room: string): void {
    // No-op: in PartyKit each party instance IS the room
  }

  /**
   * Sends a callback response to the client with the given callback ID and arguments.
   * Used for RPC-style request-response patterns.
   * 
   * @param {string} callbackId - The ID of the original callback request
   * @param {...unknown[]} args - Arguments to send back to the client
   * @returns {void}
   */
  sendCallback(callbackId: string, ...args: unknown[]): void {
    const message = JSON.stringify({ type: "callback", callbackId, args });
    this.connection.send(message);
  }
}
