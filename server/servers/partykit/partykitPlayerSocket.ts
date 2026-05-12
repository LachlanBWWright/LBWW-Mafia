/**
 * Wraps a PartyKit Connection to match the GamePlayerSocket interface
 * expected by Room and Player classes.
 */
import type { GamePlayerSocket } from "@mernmafia/shared/communication/serverTypes";
import { PartyKitMessageType } from "@mernmafia/shared/communication/events";
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
   * @param connection - The underlying PartyKit connection
   */
  constructor(connection: PartyConnectionAdapter) {
    this.connection = connection;
    this.id = connection.id;
    this.data = {};
  }

  /**
   * Joins a room (no-op in PartyKit since each party instance is already a room).
   * 
   * @param _room - The room name (unused in PartyKit)
   * @returns
   */
  join(_room: string): void {
    // No-op: in PartyKit each party instance IS the room
  }

  /**
   * Sends a callback response to the client with the given callback ID and arguments.
   * Used for RPC-style request-response patterns.
   * 
   * @param callbackId - The ID of the original callback request
   * @param args - Arguments to send back to the client
   * @returns
   */
  sendCallback(callbackId: string, ...args: unknown[]): void {
    const message = JSON.stringify({
      type: PartyKitMessageType.Callback,
      callbackId,
      args,
    });
    this.connection.send(message);
  }
}
