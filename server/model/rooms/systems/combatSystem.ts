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
      player.role.dayVisiting = null;
      player.role.visiting = null;
      player.role.roleblocked = false;
      player.role.visitors = [];
      player.role.nightTapped = false;
      if ("onNightCleanup" in player.role && typeof player.role.onNightCleanup === "function") {
        player.role.onNightCleanup();
      }
    }
    return somebodyDied;
  }
}
