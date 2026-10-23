/**
 * Wraps a PartyServer Connection to match the GamePlayerSocket interface
 * expected by Room and Player classes.
 */
import type { GamePlayerSocket } from "@mernmafia/shared/communication/serverTypes";
import { PartyServerMessageType } from "@mernmafia/shared/communication/events";
import type { Room } from "../../model/rooms/room.js";

/** Minimal connection transport surface that PartyServerPlayerSocket requires. */
export type ServerConnectionAdapter = {
  id: string;
  send(msg: string): void;
};

export class PartyServerPlayerSocket implements GamePlayerSocket {
  id: string;
  data: { roomObject?: Room; position?: number };
  private connection: ServerConnectionAdapter;

  /**
   * Creates a new PartyServer-based game player socket adapter.
   * 
   * @param connection - The underlying PartyServer connection
   */
  constructor(connection: ServerConnectionAdapter) {
    this.connection = connection;
    this.id = connection.id;
    this.data = {};
  }

  /**
   * Joins a room (no-op in PartyServer since each party instance is already a room).
   * 
   * @param _room - The room name (unused in PartyServer)
   * @returns
   */
  join(_room: string): void {
    // No-op: in PartyServer each party instance IS the room
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
      type: PartyServerMessageType.Callback,
      callbackId,
      args,
    });
    this.connection.send(message);
  }
}
