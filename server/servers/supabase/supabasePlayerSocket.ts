import type { Room } from "../../model/rooms/room.js";
import type { GamePlayerSocket } from "@mernmafia/shared/communication/serverTypes";
import { SupabaseEmitter } from "./supabaseEmitter.js";

export class SupabasePlayerSocket implements GamePlayerSocket {
  readonly data: { roomObject?: Room; position?: number } = {};

  constructor(
    readonly id: string,
    private readonly emitter: SupabaseEmitter,
  ) {}

  join(room: string): void {
    this.emitter.registerRoom(room);
  }

  sendCallback(callbackId: string, ...args: unknown[]): void {
    this.emitter.emitCallback(this.id, callbackId, args);
  }
}
