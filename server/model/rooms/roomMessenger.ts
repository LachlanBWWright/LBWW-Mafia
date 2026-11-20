import type { GameEmitter } from "@mernmafia/shared/communication/serverTypes";
import { io } from "../../servers/emitter.js";
import type { Player } from "../player/player.js";

export class RoomMessenger {
  constructor(private readonly roomName: string, private readonly emitter: GameEmitter = io) {}

  emitToRoom(event: string, ...args: unknown[]): void {
    this.emitter.to(this.roomName).emit(event, ...args);
  }

  emitToSocket(socketId: string, event: string, ...args: unknown[]): void {
    this.emitter.to(socketId).emit(event, ...args);
  }

  emitToPlayer(player: Player, event: string, ...args: unknown[]): void {
    this.emitToSocket(player.user.socketId, event, ...args);
  }

  emitToPlayers(players: Iterable<Player>, event: string, ...args: unknown[]): void {
    for (const player of players) {
      this.emitToPlayer(player, event, ...args);
    }
  }

  disconnectRoom(): void {
    this.emitter.in(this.roomName).disconnectSockets();
  }
}
