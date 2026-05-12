import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";
import type { Room } from "../room.js";

export class VisitResolutionSystem {
  constructor(private readonly room: Room) {}

  resolveNight(): void {
    this.processRoleBlockers();
    this.processVisitors();
    this.handleVisitOutcomes();
  }

  private processRoleBlockers(): void {
    for (const player of this.room.playerList) {
      if (player.role.roleblocker) {
        player.role.visit();
      }
    }
  }

  private processVisitors(): void {
    for (const player of this.room.playerList) {
      if (player.role.roleblocked && !player.role.roleblocker) {
        player.role.visiting = null;
        io.to(player.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.YouWereRoleblocked,
        });
        player.role.roleblocked = false;
      } else if (player.role.visiting !== null && !player.role.roleblocker) {
        player.role.visit();
      }
    }
  }

  private handleVisitOutcomes(): void {
    for (const player of this.room.playerList) {
      if (player.isAlive) {
        player.role.handleVisits();
      }
    }
  }
}
