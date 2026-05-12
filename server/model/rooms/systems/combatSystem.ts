import type { Room } from "../room.js";

export class CombatSystem {
  constructor(private readonly room: Room) {}

  resolveNightCleanup(nightNumber: number, drawTriggerDays: number): boolean {
    let somebodyDied = false;
    for (const player of this.room.playerList) {
      if (!player.isAlive) continue;
      if (player.role.handleDamage()) {
        somebodyDied = true;
        this.room.endDay = nightNumber + drawTriggerDays;
      }
      player.role.onNightCleanup();
    }
    return somebodyDied;
  }
}
